INSERT INTO "role_permissions" ("role", "resource", "action")
VALUES
	('cashier', 'inventory', 'unpack'),
	('supervisor', 'inventory', 'unpack'),
	('store_manager', 'inventory', 'unpack'),
	('catalog_admin', 'inventory', 'unpack'),
	('owner', 'inventory', 'unpack'),
	('inventory_staff', 'inventory', 'unpack')
ON CONFLICT DO NOTHING;
