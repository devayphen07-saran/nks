// This file is required for Expo/React Native SQLite migrations - https://orm.drizzle.team/quick-sqlite/expo

import journal from './meta/_journal.json';
import m0000 from './0000_yummy_corsair.sql';
import m0001 from './0001_district_state_guuid.sql';
import m0002 from './0002_failed_operations.sql';
import m0003 from './0003_mutation_queue_priority.sql';
import m0004 from './0004_lookup_table.sql';
import m0005 from './0005_conflict_server_state.sql';
import m0006 from './0006_multi_store.sql';
import m0007 from './0007_phase1_complete.sql';

export default {
  journal,
  migrations: {
    m0000,
    m0001,
    m0002,
    m0003,
    m0004,
    m0005,
    m0006,
    m0007,
  }
}
