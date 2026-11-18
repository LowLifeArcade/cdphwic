import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { expect, it } from 'vitest';
it('preserves existing SQL metadata and IDs, permits unknown sizes, and archives only matching legacy dummy rows', () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec('PRAGMA foreign_keys=ON');
    const directory = new URL('../db/migrations/', import.meta.url);
    for (const file of readdirSync(directory).filter(name => name.endsWith('.sql') && name < '0019').sort()) sqlite.exec(readFileSync(new URL(file, directory), 'utf8'));
    sqlite.exec(`INSERT INTO products(id,name,form,category,units_per_case,active,created_at,unit_price,generic_fields,product_code,formula_description,manufacturer,mckesson_price,covered_by_medi_cal) VALUES(301,'Nutramigen','Powder','nutritional',6,1,'2026-01-01',42.5,'{"note":"retain"}',NULL,'Preserve description','Maker',12.5,0),(302,'EleCare','Powder','exempt',6,1,'2026-01-01',48,NULL,NULL,NULL,NULL,NULL,NULL),(305,'Real catalog','ready-to-feed','standard',12,1,'2026-01-02',25,NULL,'000123','Keep me','Real maker',50,1);`);
    sqlite.exec(readFileSync(new URL('0019_product_catalog_persistence.sql', directory), 'utf8'));
    expect(sqlite.prepare('SELECT id,product_id,product_code,form,created_at,unit_price,generic_fields,formula_description,manufacturer,mckesson_price,covered_by_medi_cal FROM products WHERE id=301').get()).toMatchObject({ id:301,product_id:'PROD-301',product_code:'166802',form:'powder',created_at:'2026-01-01',unit_price:42.5,generic_fields:'{"note":"retain"}',formula_description:'Preserve description',manufacturer:'Maker',mckesson_price:12.5,covered_by_medi_cal:0 });
    expect(sqlite.prepare('SELECT active FROM products WHERE id=302').get()).toMatchObject({active:0});
    expect(sqlite.prepare('SELECT active,product_code FROM products WHERE id=305').get()).toMatchObject({active:1,product_code:'000123'});
    sqlite.exec("INSERT INTO products(product_id,product_code,name,units_per_case) VALUES('partial',NULL,'Partial',NULL),('reused','166803','Real replacement',6)");
    expect(() => sqlite.exec("INSERT INTO products(product_id,product_code) VALUES('duplicate','000123')")).toThrow('UNIQUE');
    expect(sqlite.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
});
