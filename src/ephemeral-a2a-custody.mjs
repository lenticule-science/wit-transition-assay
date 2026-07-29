function clone(value) { return value === undefined ? undefined : structuredClone(value); }

export function createEphemeralTaskStateCustody() {
  const records = new Map(); const coordinate = (taskId, tenant = "") => `${tenant}\0${taskId}`;
  return Object.freeze({
    async put(record) { records.set(coordinate(record.taskId, record.tenant), clone(record)); return clone(record); },
    async get({ taskId, tenant = "" }) { return clone(records.get(coordinate(taskId, tenant)) ?? null); },
    async list({ tenant = "" } = {}) { return [...records.values()].filter((record) => record.tenant === tenant).map(clone); },
  });
}

export function createEphemeralCoordinationStateCustody() {
  const records = new Map(); const coordinate = ({ namespace, tenant = "", key }) => `${namespace}\0${tenant}\0${key}`;
  return Object.freeze({
    async put(record) { const stored = { ...clone(record), tenant: record.tenant ?? "" }; records.set(coordinate(stored), stored); return clone(stored); },
    async get(query) { return clone(records.get(coordinate(query)) ?? null); },
    async list({ namespace, tenant = "" }) { return [...records.values()].filter((record) => record.namespace === namespace && record.tenant === tenant).map(clone); },
    async remove(query) { return records.delete(coordinate(query)); },
  });
}
