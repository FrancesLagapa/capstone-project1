import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import Icon from 'react-native-vector-icons/MaterialIcons';
import api from '../../../lib/api';
import { submitOrQueue } from '../../../lib/offlineApi';
import { cacheFaceStatus, getCachedFaceStatus } from '../../../lib/dataCache';
import { isOnline } from '../../../lib/network';
import { getUser, saveUser } from '../../../lib/userStorage';
import { useAuth } from '../../../context/authContext';
import { useOffline } from '../../../context/offlineContext';

type ProfileData = {
  firstname?: string;
  lastname?: string;
  middlename?: string | null;
  address?: string | null;
};

const ProfileScreen = () => {
  const router = useRouter();
  const { signOut } = useAuth();
  const { isOnline: online, refreshPendingCount } = useOffline();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [address, setAddress] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [faceEnrolled, setFaceEnrolled] = useState(false);
  const [faceStatusLoading, setFaceStatusLoading] = useState(true);
  const [showFacePasswordModal, setShowFacePasswordModal] = useState(false);
  const [facePassword, setFacePassword] = useState('');
  const [faceResetLoading, setFaceResetLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    loadProfile();
    loadFaceStatus();
  }, []);

  const applyProfileData = (data: ProfileData) => {
    setFirstName(data.firstname || '');
    setLastName(data.lastname || '');
    setMiddleName(data.middlename || '');
    setAddress(data.address || '');
  };

  const loadProfile = async () => {
    try {
      setProfileLoading(true);
      const connected = await isOnline();

      if (connected) {
        const { data } = await api.get('me');
        await saveUser(data);
        applyProfileData(data);
        return;
      }

      const cached = await getUser<ProfileData>();
      if (cached) {
        applyProfileData(cached);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      const cached = await getUser<ProfileData>();
      if (cached) {
        applyProfileData(cached);
      }
    } finally {
      setProfileLoading(false);
    }
  };

  const saveProfile = async () => {
    const payload = {
      firstname: firstName.trim(),
      lastname: lastName.trim(),
      middlename: middleName.trim() || null,
      address: address.trim() || null,
    };

    try {
      const result = await submitOrQueue({
        method: 'PUT',
        url: '/me',
        data: payload,
        type: 'profile-update',
        label: 'Profile update',
      });

      const cachedUser = (await getUser<Record<string, unknown>>()) ?? {};
      const mergedUser = { ...cachedUser, ...payload };
      await saveUser(mergedUser);
      applyProfileData(mergedUser);
      setIsEditing(false);

      if (result.queued) {
        await refreshPendingCount();
        Alert.alert(
          'Saved Offline',
          'Profile saved on this device. Changes will sync when you are back online.'
        );
        return;
      }

      const responseData = result.response as ProfileData | undefined;
      if (responseData) {
        await saveUser(responseData);
        applyProfileData(responseData);
      }
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (error: any) {
      console.error('Error saving profile:', error);
      const validationErrors = error?.response?.data?.errors;
      const firstField = validationErrors ? Object.keys(validationErrors)[0] : null;
      const firstMessage = firstField ? validationErrors[firstField]?.[0] : null;
      Alert.alert('Error', firstMessage || error?.response?.data?.message || 'Failed to save profile');
    }
  };

  const loadFaceStatus = async () => {
    try {
      setFaceStatusLoading(true);
      const connected = await isOnline();

      if (connected) {
        const { data } = await api.get('/face/status');
        console.log('[FACE PROFILE] status', data);
        const enrolled = data?.enrolled === true;
        setFaceEnrolled(enrolled);
        await cacheFaceStatus(enrolled);
        return;
      }

      const cached = await getCachedFaceStatus();
      setFaceEnrolled(cached === true);
    } catch (error) {
      console.error('[FACE PROFILE] status failed:', error);
      const cached = await getCachedFaceStatus();
      setFaceEnrolled(cached === true);
    } finally {
      setFaceStatusLoading(false);
    }
  };

  const handleOpenFaceAction = () => {
    if (!faceEnrolled) {
      Alert.alert(
        'Register Facial Data',
        'You have no saved face data yet. Continue to Attendance screen to register your face now?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Go to Attendance',
            onPress: () => {
              console.log('[FACE PROFILE] navigate to attendance for first enrollment');
              router.push('/Staff/Attendance' as any);
            },
          },
        ]
      );
      return;
    }

    setFacePassword('');
    setShowFacePasswordModal(true);
  };

  const handleResetFaceData = async () => {
    if (!facePassword.trim()) {
      Alert.alert('Validation', 'Please enter your password.');
      return;
    }

    try {
      setFaceResetLoading(true);
      console.log('[FACE PROFILE] reset request start');

      const result = await submitOrQueue({
        method: 'POST',
        url: '/face/reset',
        data: { password: facePassword },
        type: 'face-reset',
        label: 'Reset facial data',
      });

      if (result.queued) {
        setShowFacePasswordModal(false);
        setFacePassword('');
        setFaceEnrolled(false);
        await cacheFaceStatus(false);
        await refreshPendingCount();
        Alert.alert(
          'Saved Offline',
          'Face reset is queued. It will complete when you are back online. You can register a new face in Attendance after sync.',
          [
            { text: 'Later', style: 'cancel' },
            {
              text: 'Go to Attendance',
              onPress: () => router.push('/Staff/Attendance' as any),
            },
          ]
        );
        return;
      }

      console.log('[FACE PROFILE] reset success', result.response);
      setShowFacePasswordModal(false);
      setFacePassword('');
      setFaceEnrolled(false);
      await cacheFaceStatus(false);
      Alert.alert(
        'Facial Data Reset',
        'Your old facial data was removed. Please register your new face now in Attendance.',
        [
          { text: 'Later', style: 'cancel' },
          {
            text: 'Go to Attendance',
            onPress: () => router.push('/Staff/Attendance' as any),
          },
        ]
      );
    } catch (error: any) {
      console.error('[FACE PROFILE] reset failed', error?.response?.data || error?.message);
      const message =
        error?.response?.data?.code === 'FACE_PASSWORD_INVALID'
          ? 'Incorrect password. Please try again.'
          : error?.response?.data?.message || 'Failed to reset facial data.';
      Alert.alert('Error', message);
    } finally {
      setFaceResetLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              const connected = await isOnline();
              if (connected) {
                try {
                  await api.post('logout');
                } catch (error) {
                  console.warn('Logout API failed, clearing local session anyway:', error);
                }
              }
              await signOut();
              router.replace('/Login');
            } catch (error) {
              console.error('Error during logout:', error);
              Alert.alert('Error', 'Failed to logout');
            }
          },
        },
      ]
    );
  };

  if (profileLoading) {
    return (
      <SafeAreaView className="flex-1 justify-center items-center bg-black">
        <ActivityIndicator size="large" color="#10B981" />
        <Text className="mt-4 text-gray-400 font-medium">Loading Profile...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-black">
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        {!online && (
          <View className="bg-red-900/30 border border-red-800 rounded-xl px-4 py-3 mb-4">
            <Text className="text-red-300 text-sm font-semibold">Offline mode</Text>
            <Text className="text-red-200/80 text-xs mt-1">
              Profile changes are saved locally and will sync when connected.
            </Text>
          </View>
        )}

        {/* Profile Avatar */}
        <View className="items-center mb-8">
          <View className="w-24 h-24 rounded-full bg-green-600 justify-center items-center mb-3">
            <Icon name="person" size={50} color="#FFFFFF" />
          </View>
          <Text className="text-white text-2xl font-bold">
            {firstName && lastName ? `${firstName} ${lastName}` : 'Staff Member'}
          </Text>
        </View>

        {/* Personal Information */}
        <View className="mb-6">
          <Text className="text-white text-lg font-semibold mb-4">Personal Information</Text>

          <View className="mb-4">
            <Text className="text-gray-400 text-sm mb-1">First Name</Text>
            <TextInput
              className={`border border-gray-700 rounded-xl p-3 text-white text-base ${
                isEditing ? 'bg-gray-800' : 'bg-gray-900'
              }`}
              value={firstName}
              onChangeText={setFirstName}
              editable={isEditing}
              placeholder="Enter your first name"
              placeholderTextColor="#6B7280"
            />
          </View>

          <View className="mb-4">
            <Text className="text-gray-400 text-sm mb-1">Middle Name</Text>
            <TextInput
              className={`border border-gray-700 rounded-xl p-3 text-white text-base ${
                isEditing ? 'bg-gray-800' : 'bg-gray-900'
              }`}
              value={middleName}
              onChangeText={setMiddleName}
              editable={isEditing}
              placeholder="Enter your middle name"
              placeholderTextColor="#6B7280"
            />
          </View>

          <View className="mb-4">
            <Text className="text-gray-400 text-sm mb-1">Last Name</Text>
            <TextInput
              className={`border border-gray-700 rounded-xl p-3 text-white text-base ${
                isEditing ? 'bg-gray-800' : 'bg-gray-900'
              }`}
              value={lastName}
              onChangeText={setLastName}
              editable={isEditing}
              placeholder="Enter your last name"
              placeholderTextColor="#6B7280"
            />
          </View>

          <View className="mb-4">
            <Text className="text-gray-400 text-sm mb-1">Address</Text>
            <TextInput
              className={`border border-gray-700 rounded-xl p-3 text-white text-base ${
                isEditing ? 'bg-gray-800' : 'bg-gray-900'
              } min-h-[80px]`}
              value={address}
              onChangeText={setAddress}
              editable={isEditing}
              placeholder="Enter your address"
              placeholderTextColor="#6B7280"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>
        </View>

        {/* Facial Data Card */}
        <View className="mb-6">
          <Text className="text-white text-lg font-semibold mb-4">Facial Data</Text>
          <View className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            {faceStatusLoading ? (
              <View className="flex-row items-center">
                <ActivityIndicator size="small" color="#10B981" />
                <Text className="text-gray-400 ml-3 text-sm">Checking face status...</Text>
              </View>
            ) : (
              <>
                <Text className="text-gray-400 text-xs font-medium">Status</Text>
                <Text
                  className={`font-bold mt-1 ${
                    faceEnrolled ? 'text-green-400' : 'text-yellow-400'
                  }`}
                >
                  {faceEnrolled ? 'Registered' : 'Not registered'}
                </Text>
                <Text className="text-gray-300 text-sm mt-2 leading-5">
                  {faceEnrolled
                    ? 'To update your facial data, confirm your current password first.'
                    : 'Register your facial data to use face attendance.'}
                </Text>
                {!online && (
                  <Text className="text-amber-400/90 text-xs mt-2">
                    Face status shown from last online session.
                  </Text>
                )}
              </>
            )}
          </View>
        </View>

        {/* Facial Action Button */}
        <TouchableOpacity
          className={`bg-green-600 rounded-xl py-4 items-center mb-4 ${
            faceStatusLoading ? 'opacity-70' : ''
          }`}
          disabled={faceStatusLoading}
          onPress={handleOpenFaceAction}
        >
          <Text className="text-white font-bold text-base">
            {faceEnrolled ? 'Update Facial Data' : 'Register Facial Data'}
          </Text>
        </TouchableOpacity>

        {/* Edit/Save Button */}
        <TouchableOpacity
          className={`${isEditing ? 'bg-green-600' : 'bg-green-600'} rounded-xl py-4 items-center mb-4`}
          onPress={isEditing ? saveProfile : () => setIsEditing(true)}
        >
          <Text className="text-white font-bold text-base">
            {isEditing ? 'Save Profile' : 'Edit Profile'}
          </Text>
        </TouchableOpacity>

        {/* Logout Button */}
        <TouchableOpacity
          className="bg-red-600 rounded-xl py-4 items-center flex-row justify-center"
          onPress={handleLogout}
        >
          <Icon name="logout" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text className="text-white font-bold text-base">Logout</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Password Confirmation Modal */}
      <Modal
        visible={showFacePasswordModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFacePasswordModal(false)}
      >
        <View className="flex-1 bg-black/60 justify-center px-5">
          <View className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
            <Text className="text-white text-lg font-bold">Confirm Password</Text>
            <Text className="text-gray-400 text-sm mt-1 leading-5">
              Enter your current password to reset and update your existing facial data.
            </Text>

            <TextInput
              className="border border-gray-700 rounded-xl p-3 text-white text-base mt-4 bg-gray-800"
              secureTextEntry
              placeholder="Current password"
              placeholderTextColor="#6B7280"
              value={facePassword}
              onChangeText={setFacePassword}
              editable={!faceResetLoading}
            />

            <View className="flex-row mt-4">
              <TouchableOpacity
                className="flex-1 bg-gray-700 py-3 rounded-xl items-center mr-2"
                disabled={faceResetLoading}
                onPress={() => {
                  setShowFacePasswordModal(false);
                  setFacePassword('');
                }}
              >
                <Text className="text-white font-semibold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`flex-1 bg-red-600 py-3 rounded-xl items-center ml-2 ${
                  faceResetLoading ? 'opacity-70' : ''
                }`}
                disabled={faceResetLoading}
                onPress={handleResetFaceData}
              >
                {faceResetLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text className="text-white font-bold">Confirm</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default ProfileScreen;
