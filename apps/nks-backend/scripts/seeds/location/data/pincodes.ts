export default [
  // Chennai
  { code: '600001', localityName: 'Connaught Place', areaName: 'Central Chennai', districtName: 'Chennai', stateName: 'Tamil Nadu' },
  { code: '600002', localityName: 'Parry Corner',    areaName: 'North Chennai',   districtName: 'Chennai', stateName: 'Tamil Nadu' },
  { code: '600020', localityName: 'Mount Road',      areaName: 'Central Chennai', districtName: 'Chennai', stateName: 'Tamil Nadu' },
  // Bengaluru
  { code: '560001', localityName: 'MG Road',    areaName: 'Central Bengaluru', districtName: 'Bengaluru Urban', stateName: 'Karnataka' },
  { code: '560002', localityName: 'Cubbon Park', areaName: 'Central Bengaluru', districtName: 'Bengaluru Urban', stateName: 'Karnataka' },
  // Mumbai
  { code: '400001', localityName: 'Fort', areaName: 'South Mumbai', districtName: 'Mumbai City', stateName: 'Maharashtra' },
  // Delhi
  { code: '110001', localityName: 'Connaught Place', areaName: 'Central Delhi', districtName: 'New Delhi', stateName: 'Delhi' },
  // Kolkata
  { code: '700001', localityName: 'Esplanade', areaName: 'Central Kolkata', districtName: 'Kolkata', stateName: 'West Bengal' },
  // Hyderabad
  { code: '500001', localityName: 'Secunderabad', areaName: 'Central Hyderabad', districtName: 'Hyderabad', stateName: 'Telangana' },
] as Array<{ code: string; localityName: string; areaName?: string; districtName: string; stateName: string }>;
