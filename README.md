# ESU Management LLC website and client portal

Replaces the Gamma page at esumllc.com with a working site:

- **Public site**: services, who we serve, process, coverage, FAQ, and a working **quote request form** (saved to the admin panel and emailed to the office).
- **Client portal** (`/login`): authorized client users submit and track service requests for their buildings.
- **ESU admin** (`/admin`): every request, who submitted it, approvals, scheduling, clients, buildings, users, quotes and a security log.

## How request authorization works

| Who | Can do |
|---|---|
| **Requester** (e.g. a building super) | Submit requests only for the buildings assigned to them. |
| **Approver** (e.g. property manager) | Everything a requester can, plus approve or decline specialty work for their buildings. |
| **ESU staff** | See everything, approve on a client's behalf, schedule and close work, manage accounts. |

- Accounts are created only by ESU staff. There is no public sign-up, so every request comes from a known, named person.
- Every request stores a snapshot of the submitter (name, title, email, phone, role, IP) and the building, verified against that user's assignments at submission time.
- **Go straight to dispatch:** janitorial, general maintenance, trash removal, restocking.
- **Require approval:** carpet cleaning, tile and floor restoration, disinfection, post-construction, move-in/out and other detailed work. These sit in *Pending approval* and **cannot be scheduled** until an approver (or ESU staff) approves. If an approver submits specialty work, their approval is recorded automatically.
- Attempts to submit for an unassigned building, or to approve without rights, are blocked and recorded in the security log.

To change which work types need approval, edit `src/rules.js`.

## Run locally

Requires Node.js 22.5 or newer.

```bash
npm install
npm run dev          # http://localhost:3000 with demo data
npm test             # end-to-end tests of the authorization rules
```

Demo logins (only with `SEED_DEMO=1`): `approver@demo.test` and `super@demo.test`, password `demo-password-1`. The ESU admin login is printed in the console on first start.

## Deploy (Render)

1. Push this folder to a GitHub repository.
2. On render.com: **New > Blueprint**, choose the repository. `render.yaml` sets up the web service and a 1 GB persistent disk for the database and photos.
3. Fill in the environment variables it asks for (see `.env.example`). Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` for your first login.
4. In your domain registrar, point `esumllc.com` to the Render service (Render shows the DNS records under **Settings > Custom domains**).

Any host that runs Node 22 with a persistent disk works the same way (Railway, Fly.io, a VPS). Set `DATA_DIR` to the persistent path.

## First-time setup after deploy

1. Log in at `/login` with the admin email.
2. **Clients & users > Add a client company**, then add their buildings.
3. Add each authorized person, choose Requester or Approver, and tick their buildings. Share the temporary password privately; they must change it on first login.
4. Set up `SMTP_*` and `OFFICE_EMAIL` so the office gets an email for every new request, and approvers get an email when something needs their sign-off.

## Backups

All data lives in `DATA_DIR` (`esu.db` plus `uploads/`). Render disk snapshots run daily; you can also download the folder.
