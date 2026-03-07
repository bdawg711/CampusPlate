import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Box, Text } from '../theme/restyleTheme';
import AnimatedCard from './AnimatedCard';

// ── Types ───────────────────────────────────────────────────────────────────

export interface ForYouItem {
  id: number;
  name: string;
  calories: number;
  hallName: string;
}

export interface ForYouSubSection {
  title: string;
  iconName: string;
  items: ForYouItem[];
  filter?: string;
}

interface ForYouSectionProps {
  sections: ForYouSubSection[];
  onSeeAll?: (filter: string) => void;
  onItemPress?: (item: ForYouItem) => void;
}

// Max number of sub-sections visible at once
const MAX_VISIBLE_SECTIONS = 2;

// ── Component ───────────────────────────────────────────────────────────────

export default function ForYouSection({
  sections,
  onSeeAll,
  onItemPress,
}: ForYouSectionProps) {
  // Only show sections with items, capped at MAX_VISIBLE_SECTIONS
  const visibleSections = sections
    .filter((s) => s.items.length > 0)
    .slice(0, MAX_VISIBLE_SECTIONS);

  if (visibleSections.length === 0) {
    return (
      <Box>
        <Text variant="cardTitle" marginBottom="m">
          For You
        </Text>
        <Box
          backgroundColor="card"
          borderColor="border"
          borderWidth={1}
          borderRadius="m"
          padding="l"
          alignItems="center"
        >
          <Feather name="compass" size={32} color="#A8A9AD" />
          <Text variant="muted" style={{ marginTop: 8, textAlign: 'center' }}>
            Check back after logging a few meals
          </Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box>
      <Text variant="cardTitle" marginBottom="m">
        For You
      </Text>

      {visibleSections.map((section, idx) => (
        <Box key={section.title} style={{ marginBottom: idx < visibleSections.length - 1 ? 20 : 0 }}>
          {/* Sub-section header */}
          <Box
            flexDirection="row"
            justifyContent="space-between"
            alignItems="center"
            marginBottom="s"
          >
            <Text variant="body" style={{ fontFamily: 'DMSans_600SemiBold' }}>
              {section.title}
            </Text>
            {section.filter && onSeeAll && (
              <Text
                variant="bodySmall"
                color="maroon"
                style={{ fontFamily: 'DMSans_600SemiBold' }}
                onPress={() => onSeeAll(section.filter!)}
              >
                See All →
              </Text>
            )}
          </Box>

          {/* Horizontal scroll of food cards */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {section.items.map((item) => (
              <AnimatedCard
                key={item.id}
                padding="m"
                borderRadius="m"
                backgroundColor="card"
                borderColor="border"
                borderWidth={1}
                style={styles.foodCard}
                onPress={() => onItemPress?.(item)}
              >
                {/* Maroon left-border accent */}
                <Box style={styles.leftAccent} />

                {/* Food name — fixed 2-line slot */}
                <Text
                  variant="body"
                  style={{ fontFamily: 'DMSans_600SemiBold', lineHeight: 18, height: 36 }}
                  numberOfLines={2}
                  ellipsizeMode="tail"
                >
                  {item.name}
                </Text>

                {/* Calorie count — bold and prominent */}
                <Text
                  variant="body"
                  style={{ fontFamily: 'DMSans_700Bold', marginTop: 4, color: '#861F41' }}
                >
                  {item.calories} cal
                </Text>

                {/* Dining hall — dim, 1 line */}
                {item.hallName ? (
                  <Text variant="dim" style={{ marginTop: 2 }} numberOfLines={1}>
                    {item.hallName}
                  </Text>
                ) : null}
              </AnimatedCard>
            ))}
          </ScrollView>
        </Box>
      ))}
    </Box>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingRight: 20,
  },
  foodCard: {
    width: 164,
    height: 110,
    marginRight: 10,
    overflow: 'hidden',
  },
  leftAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: '#861F41',
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
  },
});
