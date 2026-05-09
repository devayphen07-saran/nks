import { useCallback, type ReactNode } from "react";
import { ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import styled from "styled-components/native";
import {
  Typography,
  Column,
  Row,
  LucideIcon,
  Switch,
  SegmentedTabs,
} from "@nks/mobile-ui-components";
import { useMobileTheme, type ThemePreference } from "@nks/mobile-theme";

const APP_VERSION = "2.0.4";

export function SettingsScreen() {
  const { theme, themePreference, setThemePreference } = useMobileTheme();
  const insets = useSafeAreaInsets();

  const handleThemeChange = useCallback(
    (key: string) => {
      void setThemePreference(key as ThemePreference);
    },
    [setThemePreference],
  );

  const handleNotificationToggle = useCallback((enabled: boolean) => {
    console.log("Notifications toggled:", enabled);
  }, []);

  const themeItems = [
    {
      key: "light",
      label: "Light",
      iconElement: <LucideIcon name="Sun" size={16} color={theme.colorText} />,
    },
    {
      key: "dark",
      label: "Dark",
      iconElement: <LucideIcon name="Moon" size={16} color={theme.colorText} />,
    },
    {
      key: "auto",
      label: "System",
      iconElement: <LucideIcon name="Monitor" size={16} color={theme.colorText} />,
    },
  ];

  return (
    <PageBg>
      {/* ─── Top Bar ─── */}
      <TopBar $topInset={insets.top}>
        <BackLink onPress={() => router.back()} hitSlop={8}>
          <LucideIcon
            name="ChevronLeft"
            size={18}
            color={theme.colorTextSecondary}
          />
          <Typography.Caption
            weight="medium"
            color={theme.colorTextSecondary}
            style={{ marginLeft: 4 }}
          >
            Back
          </Typography.Caption>
        </BackLink>
        <Typography.Body weight="semiBold" color={theme.colorText}>
          Settings
        </Typography.Body>
        <Spacer />
      </TopBar>

      <Hairline />

      <ScrollView
        contentContainerStyle={{
          padding: theme.sizing.large,
          paddingBottom: insets.bottom + 32,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Column gap="xLarge">
          <Section title="Appearance">
            <Card>
              <Row gap="medium" align="flex-start">
                <SectionIcon>
                  <LucideIcon
                    name="Palette"
                    size={18}
                    color={theme.colorTextSecondary}
                  />
                </SectionIcon>
                <Column gap="xxSmall" style={{ flex: 1 }}>
                  <Typography.Body weight="semiBold" color={theme.colorText}>
                    Theme
                  </Typography.Body>
                  <Typography.Caption color={theme.colorTextSecondary}>
                    Match your system or pick a fixed mode.
                  </Typography.Caption>
                </Column>
              </Row>
              <SegmentedTabs
                items={themeItems}
                selectedKey={themePreference}
                onChange={handleThemeChange}
              />
            </Card>
          </Section>

          <Section title="Notifications">
            <Card>
              <Row gap="medium" align="center">
                <SectionIcon>
                  <LucideIcon
                    name="Bell"
                    size={18}
                    color={theme.colorTextSecondary}
                  />
                </SectionIcon>
                <Column gap="xxSmall" style={{ flex: 1 }}>
                  <Typography.Body weight="semiBold" color={theme.colorText}>
                    Push notifications
                  </Typography.Body>
                  <Typography.Caption color={theme.colorTextSecondary}>
                    Order alerts, sync status, and store updates.
                  </Typography.Caption>
                </Column>
                <Switch defaultChecked onChange={handleNotificationToggle} size={32} />
              </Row>
            </Card>
          </Section>

          <Section title="Region & language">
            <Card>
              <NavRow
                icon="Globe"
                title="Timezone"
                subtitle="Used for receipts and reports."
                value="Asia/Kolkata"
              />
              <RowDivider />
              <NavRow
                icon="Languages"
                title="Language"
                subtitle="Affects all in-app text."
                value="English (US)"
              />
            </Card>
          </Section>

          <Section title="Account & data">
            <Card>
              <NavRow icon="UserCog" title="Profile" subtitle="Name, email, phone." />
              <RowDivider />
              <NavRow
                icon="Lock"
                title="Security"
                subtitle="Passcode, biometrics, sessions."
              />
              <RowDivider />
              <NavRow
                icon="Database"
                title="Data & sync"
                subtitle="Storage, offline cache, dead-letter queue."
              />
            </Card>
          </Section>

          <Section title="About">
            <Card>
              <NavRow icon="FileText" title="Privacy policy" />
              <RowDivider />
              <NavRow icon="Shield" title="Terms of service" />
              <RowDivider />
              <Row align="center" justify="space-between" style={{ paddingVertical: 6 }}>
                <Row gap="medium" align="center">
                  <SectionIcon>
                    <LucideIcon
                      name="Info"
                      size={18}
                      color={theme.colorTextSecondary}
                    />
                  </SectionIcon>
                  <Typography.Body weight="semiBold" color={theme.colorText}>
                    App version
                  </Typography.Body>
                </Row>
                <Typography.Body color={theme.colorTextSecondary}>
                  {APP_VERSION}
                </Typography.Body>
              </Row>
            </Card>
          </Section>
        </Column>
      </ScrollView>
    </PageBg>
  );
}

// ─── Reusable building blocks ────────────────────────────────────────────────

interface SectionProps {
  title: string;
  children: ReactNode;
}

function Section({ title, children }: SectionProps) {
  const { theme } = useMobileTheme();
  return (
    <Column gap="small">
      <Typography.Caption
        weight="bold"
        color={theme.colorTextTertiary}
        style={{
          textTransform: "uppercase",
          letterSpacing: 1.2,
          fontSize: 11,
          marginLeft: 4,
        }}
      >
        {title}
      </Typography.Caption>
      {children}
    </Column>
  );
}

interface NavRowProps {
  icon: string;
  title: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
}

function NavRow({ icon, title, subtitle, value, onPress }: NavRowProps) {
  const { theme } = useMobileTheme();
  return (
    <NavRowButton onPress={onPress} activeOpacity={0.6} disabled={!onPress}>
      <Row gap="medium" align="center" style={{ flex: 1 }}>
        <SectionIcon>
          <LucideIcon
            name={icon as any}
            size={18}
            color={theme.colorTextSecondary}
          />
        </SectionIcon>
        <Column gap="xxSmall" style={{ flex: 1 }}>
          <Typography.Body weight="semiBold" color={theme.colorText}>
            {title}
          </Typography.Body>
          {subtitle && (
            <Typography.Caption color={theme.colorTextSecondary}>
              {subtitle}
            </Typography.Caption>
          )}
        </Column>
      </Row>
      <Row gap="xSmall" align="center">
        {value && (
          <Typography.Caption color={theme.colorTextSecondary}>
            {value}
          </Typography.Caption>
        )}
        <LucideIcon
          name="ChevronRight"
          size={16}
          color={theme.colorTextTertiary}
        />
      </Row>
    </NavRowButton>
  );
}

// ─── Styled components ───────────────────────────────────────────────────────

const PageBg = styled.View`
  flex: 1;
  background-color: ${({ theme }) => theme.colorBgLayout};
`;

const TopBar = styled.View<{ $topInset: number }>`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding-top: ${({ $topInset, theme }) => $topInset + theme.sizing.small}px;
  padding-bottom: ${({ theme }) => theme.sizing.small}px;
  padding-left: ${({ theme }) => theme.sizing.large}px;
  padding-right: ${({ theme }) => theme.sizing.large}px;
  background-color: ${({ theme }) => theme.colorBgContainer};
`;

const BackLink = styled.TouchableOpacity`
  flex-direction: row;
  align-items: center;
  height: 32px;
  min-width: 60px;
`;

const Spacer = styled.View`
  width: 60px;
`;

const Hairline = styled.View`
  height: 1px;
  background-color: ${({ theme }) => theme.colorBorderSecondary};
`;

const Card = styled.View`
  background-color: ${({ theme }) => theme.colorBgContainer};
  border-radius: ${({ theme }) => theme.borderRadius.large}px;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colorBorderSecondary};
  padding-left: ${({ theme }) => theme.sizing.medium}px;
  padding-right: ${({ theme }) => theme.sizing.medium}px;
  padding-top: ${({ theme }) => theme.sizing.small}px;
  padding-bottom: ${({ theme }) => theme.sizing.small}px;
  gap: ${({ theme }) => theme.sizing.small}px;
`;

const SectionIcon = styled.View`
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background-color: ${({ theme }) => theme.colorBgLayout};
  align-items: center;
  justify-content: center;
`;

const NavRowButton = styled.TouchableOpacity`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding-top: 10px;
  padding-bottom: 10px;
`;

const RowDivider = styled.View`
  height: 1px;
  background-color: ${({ theme }) => theme.colorBorderSecondary};
  margin-left: 44px;
`;
