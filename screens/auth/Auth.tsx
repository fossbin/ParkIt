import React, { useState } from 'react';
import { ScrollView, TouchableOpacity, View, KeyboardAvoidingView, Image, Alert } from 'react-native';
import { Layout, Text, TextInput, Button } from "react-native-rapi-ui";
import { Feather } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase'; 
import { useNavigation } from '@react-navigation/native';   
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/types';

type AuthScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function Auth() {
  const navigation = useNavigation<AuthScreenNavigationProp>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  const validatePassword = (pwd: string): boolean => {
    return pwd.length >= 6;
  };

  async function signInWithEmail() {
    
    if (!validatePassword(password)) {
      Alert.alert("Invalid Password", "Password must be at least 6 characters long.");
      return;
    }

    setLoading(true);
    const { error, data: session } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) {
      Alert.alert("Error", error.message);
      setLoading(false);
      return;
    }

    await handlePostLogin(session.user.id);
    setLoading(false);
  }

  async function signUpWithEmail() {

    if (!validatePassword(password)) {
      Alert.alert("Invalid Password", "Password must be at least 6 characters long.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: email,
      password: password,
    });

    if (error) {
      Alert.alert("Error", error.message);
    } else {
      Alert.alert("Success", "Registration complete. Please login.");
      setIsLogin(true);
    }
    setLoading(false);
  }

  async function handlePostLogin(userId: string) {
    const { data: userRoles, error: roleError } = await supabase
      .from('user_roles')
      .select('role_id')
      .eq('user_id', userId);

    if (roleError || !userRoles) {
      Alert.alert("Error", roleError?.message || 'Roles not found.');
      return;
    }

    const roleIds = userRoles.map(userRole => userRole.role_id);
    const roles = await fetchRoleNames(roleIds);

    if (roles.includes('Admin')) {
      navigation.navigate('TabNavigatorAdmin'); 
    } else {
      navigation.navigate('RoleSelection'); 
    }
  }

  async function fetchRoleNames(roleIds: number[]): Promise<string[]> {
    const { data: rolesData, error } = await supabase
      .from('roles')
      .select('id, role_name')
      .in('id', roleIds);

    if (error || !rolesData) {
      Alert.alert("Error", error?.message || 'Roles not found.');
      return [];
    }

    return rolesData.map(role => role.role_name);
  }

  return (
    <KeyboardAvoidingView behavior="height" enabled style={{ flex: 1 }}>
      <Layout>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
          <View
            style={{
              flex: 1,
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: '#FFFFFF'
            }}
          >
            <Image
              resizeMode="contain"
              style={{ height: 220, width: 220 }}
              source={isLogin 
                ? require('../../assets/login.png') 
                : require('../../assets/register.png')}
            />
          </View>
          <View
            style={{
              flex: 3,
              paddingHorizontal: 20,
              paddingBottom: 20,
              backgroundColor: '#FFFFFF'
            }}
          >
            <Text
              fontWeight="bold"
              style={{ alignSelf: 'center', padding: 30 }}
              size="h3"
            >
              {isLogin ? 'Login' : 'Register'}
            </Text>
            <Text>Email</Text>
            <TextInput
              containerStyle={{ marginTop: 10 }}
              placeholder="Enter your email"
              value={email}
              autoCapitalize="none"
              autoComplete="off"
              autoCorrect={false}
              keyboardType="email-address"
              onChangeText={(text) => setEmail(text)}
            />

            <Text style={{ marginTop: 20 }}>Password</Text>
              <View style={{ position: 'relative' }}>
                <TextInput
                  containerStyle={{ marginTop: 8 }}
                  placeholder="Enter your password (min 6 characters)"
                  value={password}
                  autoCapitalize="none"
                  autoComplete="off"
                  autoCorrect={false}
                  secureTextEntry={!showPassword}
                  onChangeText={(text) => setPassword(text)}
                />
                <TouchableOpacity
                  style={{
                    position: 'absolute',
                    right: 15,
                    top: '50%',
                    transform: [{ translateY: -8 }],
                    zIndex: 1,
                  }}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Feather 
                    name={showPassword ? 'eye-off' : 'eye'} 
                    size={24} 
                    color="#666"
                  />
                </TouchableOpacity>
              </View>

            <Button
              text={loading ? 'Loading' : isLogin ? 'Continue' : 'Register'}
              onPress={() => {
                isLogin ? signInWithEmail() : signUpWithEmail();
              }}
              style={{ marginTop: 20 }}
              disabled={loading}
            />

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginTop: 15,
                justifyContent: 'center',
              }}
            >
              <Text size="md">
                {isLogin ? "Don't have an account?" : 'Already have an account?'}
              </Text>
              <TouchableOpacity onPress={() => setIsLogin(!isLogin)}>
                <Text
                  size="md"
                  fontWeight="bold"
                  style={{ marginLeft: 5 }}
                >
                  {isLogin ? 'Register here' : 'Login here'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </Layout>
    </KeyboardAvoidingView>
  );
}

