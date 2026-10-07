<!-- delete order -->

DELETE FROM return_items;
DELETE FROM returns;
DELETE FROM refunds;
DELETE FROM shipments;
DELETE FROM payments;
DELETE FROM order_items;

-- 3. Delete all orders
DELETE FROM orders;


<!-- delete all users -->

DELETE FROM customer_profiles;
DELETE FROM addresses;
DELETE FROM user_roles;
DELETE FROM carts;
DELETE FROM wishlists;
DELETE FROM notifications;
DELETE FROM audit_logs;

UPDATE orders SET user_id = NULL;
UPDATE returns SET user_id = NULL;
UPDATE reviews SET user_id = NULL;
UPDATE refunds SET processed_by = NULL;
UPDATE stock_transactions SET created_by = NULL;

DELETE FROM users;