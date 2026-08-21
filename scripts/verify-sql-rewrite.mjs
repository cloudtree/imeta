import { rewriteSql } from '../server/sqlRewrite.js'

const dict = {
  columns: [
    { TABLE_NAME: 'CUSTOMERS', COLUMN_NAME: 'PHONE_NO', DATA_TYPE: 'VARCHAR2' },
  ],
}

const cases = [
  {
    name: 'implicit conversion',
    sql: 'SELECT customer_id FROM customers WHERE phone_no = 1010000042',
    findings: [{ rule_id: 'D-01' }, { rule_id: 'S-04' }],
  },
  {
    name: 'upper',
    sql: "SELECT product_id FROM products WHERE UPPER(product_nm) = 'PRODUCT 0500'",
    findings: [{ rule_id: 'S-03' }, { rule_id: 'S-04' }],
  },
  {
    name: 'to_char date',
    sql: "SELECT COUNT(*) FROM orders WHERE TO_CHAR(order_date, 'YYYY-MM-DD') = '2026-01-15'",
    findings: [{ rule_id: 'S-03' }, { rule_id: 'S-04' }],
  },
  {
    name: 'status pending binds',
    sql: "SELECT order_id FROM orders WHERE status = 'PENDING'",
    findings: [{ rule_id: 'S-04' }, { rule_id: 'D-02' }, { rule_id: 'D-04' }],
  },
]

for (const c of cases) {
  const r = rewriteSql({ sqlText: c.sql, findings: c.findings, dictionary: dict })
  console.log('---', c.name, 'changed=', r.changed)
  console.log('AFTER:', r.tuned_sql)
  console.log('transforms:', r.transforms.map((t) => `${t.rule_id}:${t.title}`).join(' | '))
  console.log('notes:', r.notes.map((n) => n.rule_id).join(', '))
}
