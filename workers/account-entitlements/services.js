// The single declaration of the services that use the entitlement foundation.
// The query Worker, the picker and the paid projection read this list instead
// of spelling service names in their code.
const rows = [
  {
    id: 'harbor',
    label: 'Harbor',
    status: 'active',
    queryTokenSecret: 'HARBOR_ENTITLEMENT_QUERY_TOKEN',
    queryVersions: ['v1'],
    staffOnboarding: false,
    listed: false,
    contract: false,
    billed: false,
  },
  {
    id: 'sample',
    label: '見本のサービス',
    status: 'active',
    queryTokenSecret: 'SAMPLE_ENTITLEMENT_QUERY_TOKEN',
    queryVersions: ['v2'],
    staffOnboarding: true,
    listed: true,
    entryUrlVar: 'SAMPLE_SERVICE_URL',
    contract: true,
    billed: false,
  },
  {
    id: 'business-dossier',
    label: 'Business Dossier',
    status: 'retired',
    queryTokenSecret: 'BD_ENTITLEMENT_QUERY_TOKEN',
    queryVersions: ['v1', 'v2'],
    staffOnboarding: true,
    listed: false,
    contract: true,
    billed: true,
  },
  {
    id: 'xesm',
    label: 'XESM',
    status: 'retired',
    queryTokenSecret: 'XESM_ENTITLEMENT_QUERY_TOKEN',
    queryVersions: ['v1', 'v2'],
    staffOnboarding: true,
    listed: false,
    contract: true,
    billed: true,
  },
];

export const services = Object.freeze(rows.map(row => Object.freeze({
  ...row,
  queryVersions: Object.freeze([...row.queryVersions]),
})));

export function serviceById(id) {
  return services.find(row => row.id === id) ?? null;
}

export function activeServices() {
  return services.filter(row => row.status === 'active');
}

export function contractServices() {
  return services.filter(row => row.contract);
}
