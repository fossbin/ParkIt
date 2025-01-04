import React, { useState } from 'react';
import { StyleSheet, View, ScrollView, SafeAreaView, Linking } from 'react-native';
import { Surface, Text, Divider, List, IconButton, Button, useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';

const HelpAndSupport = () => {
  const navigation = useNavigation();
  const theme = useTheme();

  const faqData = [
    {
      question: 'How do I update my profile information?',
      answer: 'To update your profile information, go to the Account Details section and make the desired changes. Make sure to click the "Update Profile" button to save your changes.',
    },
    {
      question: 'What is the process for creating a support ticket?',
      answer: 'To create a support ticket, go to the Support section and fill out the subject, description fields and choose a priority level. Once you submit the ticket, our team will review it and get back to you as soon as possible.',
    },
    {
      question: 'How long does it take to resolve a support ticket?',
      answer: 'The resolution time for support tickets can vary depending on the complexity of the issue. Our team will work diligently to resolve your ticket as quickly as possible, but we aim to respond to all tickets within 24-48 hours.',
    },
  ];

  const handleEmailSupport = () => {
    Linking.openURL('mailto:stevedominicfez@gmail.com');
  };

  const handlePhoneSupport = () => {
    Linking.openURL('tel:9645377344');
  };

  const handleContactSupport = () => {
    navigation.navigate('SupportTicket' as never);
  };

  const FAQItem = ({ question, answer }: { question: string; answer: string }) => {
    const [expanded, setExpanded] = useState(false);
    
    return (
      <Surface style={styles.faqItemCard} elevation={1}>
        <View style={styles.questionContainer}>
          <Text style={styles.questionText}>{question}</Text>
          <IconButton
            icon={expanded ? 'chevron-up' : 'chevron-down'}
            onPress={() => setExpanded(!expanded)}
          />
        </View>
        {expanded && (
          <View style={styles.answerContainer}>
            <Divider style={styles.answerDivider} />
            <Text style={styles.answerText}>{answer}</Text>
          </View>
        )}
      </Surface>
    );
  };

  const ContactCard = ({ icon, title, subtitle, buttonText, onPress }: { icon: string; title: string; subtitle: string; buttonText: string; onPress: () => void }) => (
    <Surface style={styles.contactCard} elevation={2}>
      <IconButton
        icon={icon}
        size={24}
        iconColor={theme.colors.primary}
      />
      <View style={styles.contactContent}>
        <Text variant="titleMedium" style={styles.contactTitle}>{title}</Text>
        <Text variant="bodyMedium" style={styles.contactSubtitle}>{subtitle}</Text>
      </View>
      <Button 
        mode="contained" 
        onPress={onPress}
        style={styles.contactButton}
      >
        {buttonText}
      </Button>
    </Surface>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header Section */}
        <Surface style={styles.headerCard} elevation={2}>
          <Text variant="headlineMedium" style={styles.headerTitle}>
            Help & Support
          </Text>
          <Text variant="bodyLarge" style={styles.headerSubtitle}>
            How can we help you today?
          </Text>
        </Surface>

        {/* Contact Options */}
        <View style={styles.contactContainer}>
          <ContactCard
            icon="email"
            title="Email Support"
            subtitle="Get help via email within 24 hours"
            buttonText="Send Email"
            onPress={handleEmailSupport}
          />
          <ContactCard
            icon="phone"
            title="Phone Support"
            subtitle="Talk to our support"
            buttonText="Call Now"
            onPress={handlePhoneSupport}
          />
        </View>

        {/* FAQ Section */}
        <Surface style={styles.faqCard} elevation={2}>
          <Text variant="titleLarge" style={styles.faqTitle}>
            Frequently Asked Questions
          </Text>
          
          <View style={styles.faqContainer}>
            {faqData.map((faq, index) => (
              <React.Fragment key={index}>
                <FAQItem 
                  question={faq.question} 
                  answer={faq.answer} 
                />
                {index !== faqData.length - 1 && <View style={styles.faqSpacer} />}
              </React.Fragment>
            ))}
          </View>
        </Surface>

        {/* Still Need Help Section */}
        <Surface style={styles.needHelpCard} elevation={2}>
          <Text variant="titleMedium" style={styles.needHelpTitle}>
            Still Need Help?
          </Text>
          <Text variant="bodyMedium" style={styles.needHelpText}>
            Our support team is always here to assist you with any questions or concerns.
          </Text>
          <Button 
            mode="contained" 
            onPress={handleContactSupport}
            style={styles.needHelpButton}
          >
            Create Support Ticket
          </Button>
        </Surface>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  headerCard: {
    padding: 24,
    borderRadius: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  headerTitle: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  headerSubtitle: {
    opacity: 0.7,
    textAlign: 'center',
  },
  contactContainer: {
    marginBottom: 16,
    gap: 12,
  },
  contactCard: {
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  contactContent: {
    flex: 1,
    marginLeft: 12,
  },
  contactTitle: {
    fontWeight: '600',
  },
  contactSubtitle: {
    opacity: 0.7,
  },
  contactButton: {
    borderRadius: 8,
  },
  faqCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  faqTitle: {
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  faqContainer: {
    gap: 12,
  },
  faqItemCard: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  questionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  questionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  answerContainer: {
    padding: 16,
    paddingTop: 0,
  },
  answerDivider: {
    marginBottom: 12,
  },
  answerText: {
    opacity: 0.7,
    lineHeight: 20,
  },
  faqSpacer: {
    height: 8,
  },
  needHelpCard: {
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  needHelpTitle: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  needHelpText: {
    textAlign: 'center',
    opacity: 0.7,
    marginBottom: 16,
  },
  needHelpButton: {
    borderRadius: 8,
    paddingHorizontal: 24,
  },
});

export default HelpAndSupport;