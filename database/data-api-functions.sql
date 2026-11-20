CREATE OR REPLACE FUNCTION public.api_dashboard()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'today', jsonb_build_object(
      'order_count', (
        SELECT COUNT(*)
        FROM public.sales_order
        WHERE status = 'Completed' AND created_at::date = CURRENT_DATE
      ),
      'sales_total', (
        SELECT COALESCE(SUM(total_amount), 0)
        FROM public.sales_order
        WHERE status = 'Completed' AND created_at::date = CURRENT_DATE
      )
    ),
    'inventory', jsonb_build_object(
      'product_count', (SELECT COUNT(*) FROM public.product),
      'units_in_stock', (SELECT COALESCE(SUM(stock_quantity), 0) FROM public.product)
    ),
    'low_stock_count', (SELECT COUNT(*) FROM public.v_low_stock),
    'recent_orders', COALESCE((
      SELECT jsonb_agg(to_jsonb(recent_order))
      FROM (
        SELECT o.id, o.total_amount, o.status, o.created_at, c.name AS customer_name
        FROM public.sales_order AS o
        LEFT JOIN public.customer AS c ON c.id = o.customer_id
        ORDER BY o.created_at DESC
        LIMIT 8
      ) AS recent_order
    ), '[]'::jsonb)
  );
$$;

CREATE OR REPLACE FUNCTION public.api_low_stock()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    jsonb_agg(to_jsonb(low_stock) ORDER BY low_stock.stock_quantity, low_stock.name),
    '[]'::jsonb
  )
  FROM public.v_low_stock AS low_stock;
$$;

CREATE OR REPLACE FUNCTION public.api_sales_report(p_from date DEFAULT NULL, p_to date DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  WITH filtered_orders AS (
    SELECT o.id, o.created_at
    FROM public.sales_order AS o
    WHERE o.status = 'Completed'
      AND (p_from IS NULL OR o.created_at >= p_from::timestamp)
      AND (p_to IS NULL OR o.created_at < (p_to + 1)::timestamp)
  ),
  daily AS (
    SELECT
      fo.created_at::date AS sale_date,
      COUNT(*) AS order_count,
      SUM(o.total_amount) AS sales_total
    FROM filtered_orders AS fo
    JOIN public.sales_order AS o ON o.id = fo.id
    GROUP BY fo.created_at::date
  ),
  top_sellers AS (
    SELECT
      p.id,
      p.sku,
      p.name,
      SUM(oi.quantity) AS quantity_sold,
      SUM(oi.line_total) AS sales_total
    FROM public.order_item AS oi
    JOIN filtered_orders AS fo ON fo.id = oi.sales_order_id
    JOIN public.product AS p ON p.id = oi.product_id
    GROUP BY p.id, p.sku, p.name
    ORDER BY quantity_sold DESC
    LIMIT 10
  )
  SELECT jsonb_build_object(
    'daily', COALESCE((
      SELECT jsonb_agg(to_jsonb(day) ORDER BY day.sale_date DESC) FROM daily AS day
    ), '[]'::jsonb),
    'top_sellers', COALESCE((
      SELECT jsonb_agg(to_jsonb(seller) ORDER BY seller.quantity_sold DESC) FROM top_sellers AS seller
    ), '[]'::jsonb)
  );
$$;

CREATE OR REPLACE FUNCTION public.api_create_order(
  p_customer_id bigint,
  p_user_id bigint,
  p_status text,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  item record;
  product_row public.product%ROWTYPE;
  priced_item record;
  order_id bigint;
  total numeric(12, 2) := 0;
  line_total numeric(12, 2);
  priced_items jsonb := '[]'::jsonb;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'An order must contain at least one item.';
  END IF;
  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'An order must contain at least one item.';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('Pending', 'Completed') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'New orders may be Pending or Completed.';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_items) AS entry(value)
    GROUP BY (entry.value->>'product_id')::bigint
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Each product may only appear once in an order.';
  END IF;
  IF p_customer_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.customer WHERE id = p_customer_id
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Selected customer does not exist.';
  END IF;

  FOR item IN
    SELECT
      (entry.value->>'product_id')::bigint AS product_id,
      (entry.value->>'quantity')::integer AS quantity
    FROM jsonb_array_elements(p_items) AS entry(value)
    ORDER BY (entry.value->>'product_id')::bigint
  LOOP
    IF item.product_id IS NULL OR item.quantity IS NULL OR item.product_id <= 0 OR item.quantity <= 0 THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Product IDs and quantities must be positive.';
    END IF;
    SELECT * INTO product_row
    FROM public.product
    WHERE id = item.product_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = format('Product %s was not found.', item.product_id);
    END IF;
    IF product_row.stock_quantity < item.quantity THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = format('Not enough stock for %s. Available: %s.', product_row.name, product_row.stock_quantity);
    END IF;
    line_total := round(product_row.price * item.quantity, 2);
    total := round(total + line_total, 2);
    priced_items := priced_items || jsonb_build_array(jsonb_build_object(
      'product_id', item.product_id,
      'quantity', item.quantity,
      'price', product_row.price,
      'line_total', line_total
    ));
  END LOOP;

  INSERT INTO public.sales_order (customer_id, user_id, total_amount, status)
  VALUES (p_customer_id, p_user_id, total, p_status)
  RETURNING id INTO order_id;

  FOR priced_item IN
    SELECT *
    FROM jsonb_to_recordset(priced_items) AS row_data(
      product_id bigint,
      quantity integer,
      price numeric,
      line_total numeric
    )
  LOOP
    INSERT INTO public.order_item (sales_order_id, product_id, quantity, unit_price, line_total)
    VALUES (order_id, priced_item.product_id, priced_item.quantity, priced_item.price, priced_item.line_total);
    UPDATE public.product
    SET stock_quantity = stock_quantity - priced_item.quantity
    WHERE id = priced_item.product_id;
  END LOOP;

  RETURN jsonb_build_object('id', order_id, 'total_amount', total, 'status', p_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.api_update_order_status(p_order_id bigint, p_status text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  order_row public.sales_order%ROWTYPE;
  item record;
BEGIN
  IF p_status IS NULL OR p_status NOT IN ('Pending', 'Completed', 'Cancelled') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'status must be Pending, Completed, or Cancelled.';
  END IF;
  SELECT * INTO order_row
  FROM public.sales_order
  WHERE id = p_order_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Order not found.';
  END IF;
  IF order_row.status = 'Cancelled' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'A cancelled order cannot be reopened.';
  END IF;
  IF order_row.status = 'Completed' AND p_status = 'Pending' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'A completed order cannot be changed back to pending.';
  END IF;

  IF p_status = 'Cancelled' THEN
    FOR item IN
      SELECT product_id, quantity
      FROM public.order_item
      WHERE sales_order_id = order_row.id
      ORDER BY product_id
    LOOP
      UPDATE public.product
      SET stock_quantity = stock_quantity + item.quantity
      WHERE id = item.product_id;
    END LOOP;
  END IF;

  UPDATE public.sales_order SET status = p_status WHERE id = order_row.id;
  RETURN jsonb_build_object('message', 'Order status updated.', 'status', p_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.api_record_stock_in(
  p_product_id bigint,
  p_supplier_id bigint,
  p_user_id bigint,
  p_quantity integer,
  p_cost_per_unit numeric,
  p_notes text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  stock_in_id bigint;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 OR p_cost_per_unit IS NULL OR p_cost_per_unit < 0 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Quantity must be positive and cost must not be negative.';
  END IF;
  PERFORM 1 FROM public.product WHERE id = p_product_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Product not found.';
  END IF;

  INSERT INTO public.stock_in (product_id, supplier_id, user_id, quantity, cost_per_unit, notes)
  VALUES (p_product_id, p_supplier_id, p_user_id, p_quantity, p_cost_per_unit, p_notes)
  RETURNING id INTO stock_in_id;
  UPDATE public.product
  SET stock_quantity = stock_quantity + p_quantity
  WHERE id = p_product_id;

  RETURN jsonb_build_object('id', stock_in_id);
END;
$$;

REVOKE ALL ON FUNCTION public.api_dashboard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.api_low_stock() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.api_sales_report(date, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.api_create_order(bigint, bigint, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.api_update_order_status(bigint, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.api_record_stock_in(bigint, bigint, bigint, integer, numeric, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.api_dashboard() TO service_role;
GRANT EXECUTE ON FUNCTION public.api_low_stock() TO service_role;
GRANT EXECUTE ON FUNCTION public.api_sales_report(date, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.api_create_order(bigint, bigint, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.api_update_order_status(bigint, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.api_record_stock_in(bigint, bigint, bigint, integer, numeric, text) TO service_role;
