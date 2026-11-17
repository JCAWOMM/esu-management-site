// Business rules: which work types go straight to the queue and which need approval.
// To change the rules, edit this list. `approval: true` means the request is held
// as "Pending approval" and cannot be scheduled until an authorized approver signs off.
const CATEGORIES = [
  { key: 'janitorial',   label: 'Janitorial / routine cleaning',         approval: false },
  { key: 'maintenance',  label: 'General maintenance / light repair',    approval: false },
  { key: 'trash',        label: 'Trash removal',                         approval: false },
  { key: 'restock',      label: 'Restocking / porter support',           approval: false },
  { key: 'carpet',       label: 'Carpet cleaning',                       approval: true },
  { key: 'floor',        label: 'Tile & floor restoration (strip, wax, scrub)', approval: true },
  { key: 'disinfection', label: 'Targeted disinfection',                 approval: true },
  { key: 'postconstruction', label: 'Post-construction cleanup',         approval: true },
  { key: 'moveinout',    label: 'Move-in / move-out cleaning',           approval: true },
  { key: 'other_detail', label: 'Other detailed or specialty work',      approval: true },
];
const CATEGORY = Object.fromEntries(CATEGORIES.map(c => [c.key, c]));

const PRIORITIES = [
  { key: 'routine',   label: 'Routine (48–72 hrs)' },
  { key: 'urgent',    label: 'Urgent (24 hrs)' },
  { key: 'emergency', label: 'Emergency (same day)' },
];
const PRIORITY = Object.fromEntries(PRIORITIES.map(p => [p.key, p]));

const STATUSES = {
  pending_approval: 'Pending approval',
  open: 'Open',
  scheduled: 'Scheduled',
  in_progress: 'In progress',
  completed: 'Completed',
  declined: 'Declined',
  cancelled: 'Cancelled',
};
// Statuses ESU staff may move an approved/open request into.
const WORK_STATUSES = ['open', 'scheduled', 'in_progress', 'completed', 'cancelled'];

const ROLES = {
  requester: 'Requester — can submit requests',
  approver: 'Approver — can submit and approve specialty work',
  admin: 'ESU staff (admin)',
};

const BOROUGHS = ['Brooklyn', 'Manhattan', 'Queens', 'Bronx', 'Staten Island', 'Outside NYC'];

module.exports = { CATEGORIES, CATEGORY, PRIORITIES, PRIORITY, STATUSES, WORK_STATUSES, ROLES, BOROUGHS };
