-- PANATOS@ORCLPDB 튜닝 테스트 SQL
-- iMETA: 서버=oracle(panatos), 스키마(선택)=비움 또는 PANATOS

SELECT order_id, order_date, amount FROM orders WHERE status = 'PENDING';

SELECT customer_id, customer_nm FROM customers WHERE phone_no = 1010000042;

SELECT product_id, unit_price FROM products WHERE UPPER(product_nm) = 'PRODUCT 0500';

SELECT COUNT(*) FROM orders WHERE TO_CHAR(order_date, 'YYYY-MM-DD') = '2026-01-15';

SELECT c.customer_nm, o.order_id, i.qty
FROM customers c
JOIN orders o ON o.customer_id = c.customer_id
JOIN order_items i ON i.order_id = o.order_id
WHERE c.customer_nm LIKE '%00042%';
