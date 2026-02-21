import React from 'react';
import { TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Box, Text } from '../theme/restyleTheme';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

function ErrorState({
  message = "Couldn't load data",
  onRetry,
}: ErrorStateProps) {
  return (
    <Box alignItems="center" paddingVertical="xl" paddingHorizontal="l" style={{ gap: 12 }}>
      <Feather name="alert-circle" size={36} color="#A8A9AD" accessibilityElementsHidden />
      <Text
        variant="muted"
        style={{ textAlign: 'center', fontSize: 14, lineHeight: 20 }}
      >
        {message}
      </Text>
      {onRetry && (
        <TouchableOpacity
          onPress={onRetry}
          accessibilityLabel="Try again"
          accessibilityRole="button"
          activeOpacity={0.7}
          style={{
            paddingHorizontal: 24,
            paddingVertical: 10,
            minHeight: 44,
            justifyContent: 'center',
            borderRadius: 8,
            borderWidth: 1,
            borderColor: '#E8E8EA',
            backgroundColor: '#FFFFFF',
            marginTop: 4,
          }}
        >
          <Text
            variant="body"
            style={{ color: '#861F41', fontFamily: 'DMSans_600SemiBold' }}
          >
            Try Again
          </Text>
        </TouchableOpacity>
      )}
    </Box>
  );
}

export default React.memo(ErrorState);
