import React, { useState, useEffect } from 'react';
import {
  ScrollView,
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  Modal,
  SafeAreaView,
} from 'react-native';
import { sql } from 'drizzle-orm';
import { LucideIcon } from '@nks/mobile-ui-components';
import { useMobileTheme } from '@nks/mobile-theme';
import { state as dbState } from '../../lib/database/connection/state';

interface DebugDatabaseScreenProps {
  visible: boolean;
  onClose: () => void;
}

export function DebugDatabaseScreen({ visible, onClose }: DebugDatabaseScreenProps) {
  const { theme } = useMobileTheme();
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableData, setTableData] = useState<any[]>([]);
  const [rowCount, setRowCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      loadTables();
    }
  }, [visible]);

  const loadTables = async () => {
    try {
      setLoading(true);
      setError(null);
      const drizzleDb = dbState.drizzleDb;
      if (!drizzleDb) {
        setError('Database not initialized');
        setLoading(false);
        return;
      }

      const result = drizzleDb.all(
        sql`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`
      );
      const tableNames = (result as any[])?.map((r) => r.name) || [];
      setTables(tableNames);
      setSelectedTable(null);
      setTableData([]);
      setLoading(false);
    } catch (err) {
      console.error('Error loading tables:', err);
      setError(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setLoading(false);
    }
  };

  const loadTableData = async (tableName: string) => {
    try {
      setLoading(true);
      setError(null);
      const drizzleDb = dbState.drizzleDb;
      if (!drizzleDb) {
        setError('Database not initialized');
        setLoading(false);
        return;
      }

      const countResult = drizzleDb.all(
        sql.raw(`SELECT COUNT(*) as count FROM ${tableName}`)
      );
      const count = (countResult as any[])[0]?.count ?? 0;
      setRowCount(count);

      const rows = drizzleDb.all(
        sql.raw(`SELECT * FROM ${tableName} LIMIT 50`)
      );
      setTableData(rows as any[]);
      setSelectedTable(tableName);
      setLoading(false);
    } catch (err) {
      console.error('Query error:', err);
      setError(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setLoading(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colorBgLayout }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.colorBorderSecondary }]}>
          <Text style={[styles.title, { color: theme.colorText }]}>📊 SQLite Debug</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <LucideIcon name="X" size={24} color={theme.colorText} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {error && (
            <View style={[styles.errorBanner, { backgroundColor: theme.colorErrorBg }]}>
              <Text style={[styles.errorText, { color: theme.colorError }]}>{error}</Text>
            </View>
          )}

          {/* Tables List */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colorText }]}>Tables ({tables.length})</Text>

            {tables.length === 0 ? (
              <Text style={[styles.emptyText, { color: theme.colorTextSecondary }]}>No tables found</Text>
            ) : (
              tables.map((table) => (
                <TouchableOpacity
                  key={table}
                  style={[
                    styles.tableButton,
                    {
                      backgroundColor: selectedTable === table ? theme.colorPrimaryBg : theme.colorBgContainer,
                      borderColor: selectedTable === table ? theme.colorPrimary : theme.colorBorderSecondary,
                    },
                  ]}
                  onPress={() => loadTableData(table)}
                  disabled={loading}
                >
                  <Text
                    style={[
                      styles.tableButtonText,
                      {
                        color: selectedTable === table ? theme.colorPrimary : theme.colorText,
                        fontWeight: selectedTable === table ? '600' : '500',
                      },
                    ]}
                  >
                    {table}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </View>

          {/* Table Data */}
          {selectedTable && (
            <View style={styles.section}>
              <View style={styles.dataHeader}>
                <Text style={[styles.sectionTitle, { color: theme.colorText }]}>{selectedTable}</Text>
                <Text style={[styles.rowCount, { color: theme.colorTextSecondary }]}>
                  {rowCount} rows {tableData.length < rowCount && `(showing ${tableData.length})`}
                </Text>
              </View>

              {loading ? (
                <Text style={[styles.loadingText, { color: theme.colorTextSecondary }]}>Loading...</Text>
              ) : tableData.length === 0 ? (
                <Text style={[styles.emptyText, { color: theme.colorTextSecondary }]}>No data in this table</Text>
              ) : (
                tableData.map((row, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.dataRow,
                      {
                        backgroundColor: theme.colorBgContainer,
                        borderColor: theme.colorBorderSecondary,
                      },
                    ]}
                  >
                    <Text style={[styles.dataText, { color: theme.colorText }]}>
                      {JSON.stringify(row, null, 2)}
                    </Text>
                  </View>
                ))
              )}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  tableButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    borderRadius: 6,
    borderWidth: 1,
  },
  tableButtonText: {
    fontSize: 12,
  },
  dataHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  rowCount: {
    fontSize: 12,
  },
  dataRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    borderRadius: 6,
    borderWidth: 1,
  },
  dataText: {
    fontSize: 11,
    fontFamily: 'monospace',
    lineHeight: 16,
  },
  emptyText: {
    fontSize: 12,
    fontStyle: 'italic',
    marginVertical: 12,
  },
  loadingText: {
    fontSize: 12,
    marginVertical: 12,
  },
  errorBanner: {
    padding: 12,
    marginBottom: 12,
    borderRadius: 6,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
