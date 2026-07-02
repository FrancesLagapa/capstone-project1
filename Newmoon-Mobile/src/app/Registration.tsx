import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { useAuth } from '../../context/authContext';
import api from '../../lib/api';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type RegisterFormData = {
    username: string;
    firstname: string;
    lastname: string;
    middlename: string;
    email: string;
    phone: string;
    address: string;
    password: string;
    password_confirmation: string;
};

type RegisterFormField = keyof RegisterFormData;

const REQUIRED_FIELDS: RegisterFormField[] = [
    'username',
    'firstname',
    'lastname',
    'email',
    'password',
    'password_confirmation',
];

export default function RegisterScreen() {
    const router = useRouter();
    const { register } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [agreeTerms, setAgreeTerms] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Form fields
    const [formData, setFormData] = useState<RegisterFormData>({
        username: '',
        firstname: '',
        lastname: '',
        middlename: '',
        email: '',
        phone: '',
        address: '',
        password: '',
        password_confirmation: '',
    });

    // Validation functions
    const validateField = (name: RegisterFormField, value: string) => {
        const newErrors = { ...errors };

        switch (name) {
            case 'username':
                if (!value) newErrors.username = 'Username is required';
                else if (value.length < 3) newErrors.username = 'Username must be at least 3 characters';
                else if (value.length > 255) newErrors.username = 'Username must be less than 255 characters';
                else if (!/^[a-zA-Z0-9_]+$/.test(value)) newErrors.username = 'Username can only contain letters, numbers, and underscores';
                else delete newErrors.username;
                break;

            case 'firstname':
                if (!value) newErrors.firstname = 'First name is required';
                else if (value.length < 2) newErrors.firstname = 'First name must be at least 2 characters';
                else delete newErrors.firstname;
                break;

            case 'lastname':
                if (!value) newErrors.lastname = 'Last name is required';
                else if (value.length < 2) newErrors.lastname = 'Last name must be at least 2 characters';
                else delete newErrors.lastname;
                break;

            case 'email':
                if (!value) newErrors.email = 'Email is required';
                else if (!/\S+@\S+\.\S+/.test(value)) newErrors.email = 'Please enter a valid email address';
                else delete newErrors.email;
                break;

            case 'phone':
                if (value && !/^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/.test(value)) {
                    newErrors.phone = 'Please enter a valid phone number';
                } else {
                    delete newErrors.phone;
                }
                break;

            case 'password':
                if (!value) newErrors.password = 'Password is required';
                else if (value.length < 8) newErrors.password = 'Password must be at least 8 characters';
                else if (!/[A-Z]/.test(value)) newErrors.password = 'Password must contain at least one uppercase letter';
                else if (!/[a-z]/.test(value)) newErrors.password = 'Password must contain at least one lowercase letter';
                else if (!/[0-9]/.test(value)) newErrors.password = 'Password must contain at least one number';
                else delete newErrors.password;

                // Also validate password confirmation if it exists
                if (formData.password_confirmation && value !== formData.password_confirmation) {
                    newErrors.password_confirmation = 'Passwords do not match';
                } else if (formData.password_confirmation) {
                    delete newErrors.password_confirmation;
                }
                break;

            case 'password_confirmation':
                if (!value) newErrors.password_confirmation = 'Please confirm your password';
                else if (value !== formData.password) newErrors.password_confirmation = 'Passwords do not match';
                else delete newErrors.password_confirmation;
                break;

            default:
                delete newErrors[name];
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleInputChange = (name: RegisterFormField, value: string) => {
        setFormData((prev) => ({ ...prev, [name]: value }));
        validateField(name, value);
    };

    const checkUsernameAvailability = async (username: string) => {
        if (username.length < 3) return true;

        try {
            const response = await api.post('/check-username', { username });
            if (!response.data.available) {
                setErrors(prev => ({ ...prev, username: 'Username is already taken' }));
                return false;
            }
            return true;
        } catch (error) {
            console.error('Error checking username:', error);
            return true;
        }
    };

    const checkEmailAvailability = async (email: string) => {
        if (!email || !/\S+@\S+\.\S+/.test(email)) return true;

        try {
            const response = await api.post('/check-email', { email });
            if (!response.data.available) {
                setErrors(prev => ({ ...prev, email: 'Email is already registered' }));
                return false;
            }
            return true;
        } catch (error) {
            console.error('Error checking email:', error);
            return true;
        }
    };

    const handleRegister = async () => {
        // Validate all fields
        const fieldsToValidate = REQUIRED_FIELDS;
        let isValid = true;

        fieldsToValidate.forEach((field) => {
            if (!validateField(field, formData[field])) {
                isValid = false;
            }
        });

        if (!agreeTerms) {
            Alert.alert('Terms & Conditions', 'Please agree to the Terms and Conditions to continue.');
            return;
        }

        if (!isValid) {
            Alert.alert('Validation Error', 'Please fix all errors before submitting.');
            return;
        }

        // Check username and email availability
        const isUsernameAvailable = await checkUsernameAvailability(formData.username);
        const isEmailAvailable = await checkEmailAvailability(formData.email);

        if (!isUsernameAvailable || !isEmailAvailable) {
            return;
        }

        setIsLoading(true);

        try {
            const result = await register(formData);

            if (result.success) {
                // FIX: Redirect to Login screen instead of dashboard
                Alert.alert(
                    'Registration Successful! 🎉',
                    'Your customer account has been created successfully. Please login to continue.',
                    [
                        {
                            text: 'Go to Login',
                            onPress: () => {
                                // Navigate back to login screen
                                router.replace('/Login');
                                // Or if login is nested in a different folder:
                                // router.replace('/(auth)/Login');
                            },
                        },
                    ]
                );
            } else {
                if (result.errors) {
                    setErrors(result.errors);
                }
                Alert.alert('Registration Failed', result.error || 'Something went wrong. Please try again.');
            }
        } catch (error) {
            console.error('Registration error:', error);
            Alert.alert(
                'Network Error',
                'Unable to connect to the server. Please check your internet connection and try again.'
            );
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-blue-600">
            <StatusBar style="light" />
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1"
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
                <ScrollView
                    className="flex-1"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 40 }}
                >
                    <View className="flex-1 px-6 pt-8 pb-4">
                        {/* Header */}
                        <View className="items-center mb-6">
                            <TouchableOpacity
                                onPress={() => router.back()}
                                className="absolute left-0 top-2 p-2"
                            >
                                <Ionicons name="arrow-back" size={28} color="white" />
                            </TouchableOpacity>
                            <Text className="text-3xl font-bold text-white text-center">
                                Create Account
                            </Text>
                            <Text className="text-white/80 text-center mt-2">
                                Register as a customer
                            </Text>
                        </View>

                        {/* Registration Form Card */}
                        <View className="bg-white rounded-3xl p-6 shadow-2xl">
                            <Text className="text-2xl font-bold text-gray-800 text-center mb-6">
                                Customer Registration
                            </Text>

                            {/* Personal Information Section */}
                            <Text className="text-sm font-semibold text-blue-600 mb-3">
                                Personal Information
                            </Text>

                            {/* First Name */}
                            <View className="mb-4">
                                <Text className="text-sm font-semibold text-gray-700 mb-1">
                                    First Name <Text className="text-red-500">*</Text>
                                </Text>
                                <TextInput
                                    className={`border rounded-xl p-3 bg-gray-50 text-gray-800 ${
                                        errors.firstname ? 'border-red-500' : 'border-gray-300'
                                    }`}
                                    placeholder="Enter first name"
                                    placeholderTextColor="#9CA3AF"
                                    value={formData.firstname}
                                    onChangeText={(text) => handleInputChange('firstname', text)}
                                    autoCapitalize="words"
                                />
                                {errors.firstname && (
                                    <Text className="text-red-500 text-xs mt-1">{errors.firstname}</Text>
                                )}
                            </View>

                            {/* Last Name */}
                            <View className="mb-4">
                                <Text className="text-sm font-semibold text-gray-700 mb-1">
                                    Last Name <Text className="text-red-500">*</Text>
                                </Text>
                                <TextInput
                                    className={`border rounded-xl p-3 bg-gray-50 text-gray-800 ${
                                        errors.lastname ? 'border-red-500' : 'border-gray-300'
                                    }`}
                                    placeholder="Enter last name"
                                    placeholderTextColor="#9CA3AF"
                                    value={formData.lastname}
                                    onChangeText={(text) => handleInputChange('lastname', text)}
                                    autoCapitalize="words"
                                />
                                {errors.lastname && (
                                    <Text className="text-red-500 text-xs mt-1">{errors.lastname}</Text>
                                )}
                            </View>

                            {/* Middle Name (Optional) */}
                            <View className="mb-4">
                                <Text className="text-sm font-semibold text-gray-700 mb-1">
                                    Middle Name <Text className="text-gray-400">(Optional)</Text>
                                </Text>
                                <TextInput
                                    className="border border-gray-300 rounded-xl p-3 bg-gray-50 text-gray-800"
                                    placeholder="Enter middle name"
                                    placeholderTextColor="#9CA3AF"
                                    value={formData.middlename}
                                    onChangeText={(text) => handleInputChange('middlename', text)}
                                    autoCapitalize="words"
                                />
                            </View>

                            {/* Username */}
                            <View className="mb-4">
                                <Text className="text-sm font-semibold text-gray-700 mb-1">
                                    Username <Text className="text-red-500">*</Text>
                                </Text>
                                <TextInput
                                    className={`border rounded-xl p-3 bg-gray-50 text-gray-800 ${
                                        errors.username ? 'border-red-500' : 'border-gray-300'
                                    }`}
                                    placeholder="Choose a username"
                                    placeholderTextColor="#9CA3AF"
                                    value={formData.username}
                                    onChangeText={(text) => handleInputChange('username', text.toLowerCase())}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                />
                                {errors.username && (
                                    <Text className="text-red-500 text-xs mt-1">{errors.username}</Text>
                                )}
                            </View>

                            {/* Email */}
                            <View className="mb-4">
                                <Text className="text-sm font-semibold text-gray-700 mb-1">
                                    Email Address <Text className="text-red-500">*</Text>
                                </Text>
                                <TextInput
                                    className={`border rounded-xl p-3 bg-gray-50 text-gray-800 ${
                                        errors.email ? 'border-red-500' : 'border-gray-300'
                                    }`}
                                    placeholder="Enter email address"
                                    placeholderTextColor="#9CA3AF"
                                    value={formData.email}
                                    onChangeText={(text) => handleInputChange('email', text.toLowerCase())}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                />
                                {errors.email && (
                                    <Text className="text-red-500 text-xs mt-1">{errors.email}</Text>
                                )}
                            </View>

                            {/* Phone (Optional) */}
                            <View className="mb-4">
                                <Text className="text-sm font-semibold text-gray-700 mb-1">
                                    Phone Number <Text className="text-gray-400">(Optional)</Text>
                                </Text>
                                <TextInput
                                    className={`border rounded-xl p-3 bg-gray-50 text-gray-800 ${
                                        errors.phone ? 'border-red-500' : 'border-gray-300'
                                    }`}
                                    placeholder="Enter phone number"
                                    placeholderTextColor="#9CA3AF"
                                    value={formData.phone}
                                    onChangeText={(text) => handleInputChange('phone', text)}
                                    keyboardType="phone-pad"
                                />
                                {errors.phone && (
                                    <Text className="text-red-500 text-xs mt-1">{errors.phone}</Text>
                                )}
                            </View>

                            {/* Address (Optional) */}
                            <View className="mb-4">
                                <Text className="text-sm font-semibold text-gray-700 mb-1">
                                    Address <Text className="text-gray-400">(Optional)</Text>
                                </Text>
                                <TextInput
                                    className="border border-gray-300 rounded-xl p-3 bg-gray-50 text-gray-800"
                                    placeholder="Enter your address"
                                    placeholderTextColor="#9CA3AF"
                                    value={formData.address}
                                    onChangeText={(text) => handleInputChange('address', text)}
                                    multiline
                                    numberOfLines={2}
                                />
                            </View>

                            {/* Security Section */}
                            <Text className="text-sm font-semibold text-blue-600 mb-3 mt-2">
                                Security
                            </Text>

                            {/* Password */}
                            <View className="mb-4">
                                <Text className="text-sm font-semibold text-gray-700 mb-1">
                                    Password <Text className="text-red-500">*</Text>
                                </Text>
                                <View className={`flex-row items-center border rounded-xl bg-gray-50 ${
                                    errors.password ? 'border-red-500' : 'border-gray-300'
                                }`}>
                                    <TextInput
                                        className="flex-1 p-3 text-gray-800"
                                        placeholder="Create a strong password"
                                        placeholderTextColor="#9CA3AF"
                                        secureTextEntry={!showPassword}
                                        value={formData.password}
                                        onChangeText={(text) => handleInputChange('password', text)}
                                    />
                                    <TouchableOpacity
                                        onPress={() => setShowPassword(!showPassword)}
                                        className="pr-3"
                                    >
                                        <Ionicons
                                            name={showPassword ? 'eye-off' : 'eye'}
                                            size={24}
                                            color="#6B7280"
                                        />
                                    </TouchableOpacity>
                                </View>
                                {errors.password && (
                                    <Text className="text-red-500 text-xs mt-1">{errors.password}</Text>
                                )}
                                <Text className="text-gray-500 text-xs mt-1">
                                    Minimum 8 characters with uppercase, lowercase, and number
                                </Text>
                            </View>

                            {/* Confirm Password */}
                            <View className="mb-4">
                                <Text className="text-sm font-semibold text-gray-700 mb-1">
                                    Confirm Password <Text className="text-red-500">*</Text>
                                </Text>
                                <View className={`flex-row items-center border rounded-xl bg-gray-50 ${
                                    errors.password_confirmation ? 'border-red-500' : 'border-gray-300'
                                }`}>
                                    <TextInput
                                        className="flex-1 p-3 text-gray-800"
                                        placeholder="Confirm your password"
                                        placeholderTextColor="#9CA3AF"
                                        secureTextEntry={!showConfirmPassword}
                                        value={formData.password_confirmation}
                                        onChangeText={(text) => handleInputChange('password_confirmation', text)}
                                    />
                                    <TouchableOpacity
                                        onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="pr-3"
                                    >
                                        <Ionicons
                                            name={showConfirmPassword ? 'eye-off' : 'eye'}
                                            size={24}
                                            color="#6B7280"
                                        />
                                    </TouchableOpacity>
                                </View>
                                {errors.password_confirmation && (
                                    <Text className="text-red-500 text-xs mt-1">{errors.password_confirmation}</Text>
                                )}
                            </View>

                            {/* Terms and Conditions */}
                            <TouchableOpacity
                                className="flex-row items-center mb-6 mt-2"
                                onPress={() => setAgreeTerms(!agreeTerms)}
                            >
                                <View className={`w-5 h-5 border-2 rounded-md mr-3 items-center justify-center ${
                                    agreeTerms ? 'bg-blue-600 border-blue-600' : 'border-gray-400'
                                }`}>
                                    {agreeTerms && <Ionicons name="checkmark" size={16} color="white" />}
                                </View>
                                <Text className="text-gray-600 text-sm flex-1">
                                    I agree to the{' '}
                                    <Text className="text-blue-600 font-semibold">Terms and Conditions</Text>
                                    {' '}and{' '}
                                    <Text className="text-blue-600 font-semibold">Privacy Policy</Text>
                                </Text>
                            </TouchableOpacity>

                            {/* Register Button */}
                            <TouchableOpacity
                                className={`bg-blue-600 p-4 rounded-xl items-center shadow-lg ${
                                    isLoading ? 'opacity-70' : ''
                                }`}
                                onPress={handleRegister}
                                disabled={isLoading}
                                activeOpacity={0.8}
                            >
                                {isLoading ? (
                                    <View className="flex-row items-center">
                                        <ActivityIndicator color="white" size="small" />
                                        <Text className="text-white font-bold text-lg ml-2">
                                            Creating Account...
                                        </Text>
                                    </View>
                                ) : (
                                    <Text className="text-white font-bold text-lg">
                                        Create Account
                                    </Text>
                                )}
                            </TouchableOpacity>

                            {/* Divider */}
                            <View className="flex-row items-center my-6">
                                <View className="flex-1 h-px bg-gray-300" />
                                <Text className="text-gray-400 px-4 text-sm">OR</Text>
                                <View className="flex-1 h-px bg-gray-300" />
                            </View>

                            {/* Login Link */}
                            <View className="flex-row justify-center">
                                <Text className="text-gray-500 text-sm">Already have an account? </Text>
                                <TouchableOpacity onPress={() => router.push('/Login')}>
                                    <Text className="text-blue-600 text-sm font-semibold">
                                        Sign In
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Footer */}
                        <Text className="text-white/60 text-center text-xs mt-8">
                            © 2024 New Moon Lechon Manok. All rights reserved.
                        </Text>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}