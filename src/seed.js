// First-run setup: creates the ESU admin login, and optional demo data.
const { one, run, tx } = require('./db');
const A = require('./auth');

function runSeed() {
  const hasAdmin = one("SELECT id FROM users WHERE role = 'admin'");
  if (!hasAdmin) {
    const email = (process.env.ADMIN_EMAIL || 'admin@esumllc.com').toLowerCase();
    const password = process.env.ADMIN_PASSWORD || A.randomPassword();
    run("INSERT INTO users (client_id, name, email, role, password_hash, must_change_password) VALUES (NULL, 'ESU Admin', ?, 'admin', ?, ?)",
      email, A.hashPassword(password), process.env.ADMIN_PASSWORD ? 0 : 1);
    console.log(`\n=== ESU admin login created: ${email}${process.env.ADMIN_PASSWORD ? '' : `  temporary password: ${password}`} ===\n`);
  }

  if (process.env.SEED_DEMO === '1' && !one('SELECT id FROM clients')) {
    const pw = A.hashPassword('demo-password-1');
    tx(() => {
      const c = Number(run("INSERT INTO clients (name) VALUES ('Atlantic Property Group (demo)')").lastInsertRowid);
      const l1 = Number(run("INSERT INTO locations (client_id, name, address, borough) VALUES (?, '450 Atlantic Ave', '450 Atlantic Ave, Brooklyn, NY 11217', 'Brooklyn')", c).lastInsertRowid);
      const l2 = Number(run("INSERT INTO locations (client_id, name, address, borough) VALUES (?, '88 Court St', '88 Court St, Brooklyn, NY 11201', 'Brooklyn')", c).lastInsertRowid);
      const l3 = Number(run("INSERT INTO locations (client_id, name, address, borough) VALUES (?, '210 W 29th St', '210 W 29th St, New York, NY 10001', 'Manhattan')", c).lastInsertRowid);
      const mk = (name, title, email, role, locs) => {
        const id = Number(run('INSERT INTO users (client_id, name, title, email, phone, role, password_hash, must_change_password) VALUES (?,?,?,?,?,?,?,0)', c, name, title, email, '(718) 555-0100', role, pw).lastInsertRowid);
        locs.forEach(l => run('INSERT INTO user_locations VALUES (?,?)', id, l));
      };
      mk('Dana Rivera', 'Property Manager', 'approver@demo.test', 'approver', [l1, l2, l3]);
      mk('Sam Lee', 'Building Super', 'super@demo.test', 'requester', [l1]);
    });
    console.log('Demo client created: approver@demo.test / super@demo.test (password: demo-password-1)');
  }
}

module.exports = { run: runSeed };
