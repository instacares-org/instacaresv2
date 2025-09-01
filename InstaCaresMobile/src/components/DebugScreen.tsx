import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
} from 'react-native';
import { authAPI, caregiversAPI, chatAPI } from '../services/api';

const colors = {
  primary: '#FF385C',
  black: '#222222',
  gray: '#767676',
  white: '#FFFFFF',
  success: '#008489',
  error: '#FF3B30',
  background: '#F7F7F7',
};

export const DebugScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [logs, setLogs] = useState<string[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const testAPIConnection = async () => {
    addLog('🔗 Testing API connection...');
    
    try {
      const response = await fetch('http://10.0.0.24:3005/api/auth/me');
      addLog(`📡 API Response Status: ${response.status}`);
      
      if (response.ok) {
        const data = await response.json();
        addLog('✅ API Connection successful!');
        addLog(`📋 Response: ${JSON.stringify(data, null, 2)}`);
      } else {
        const errorText = await response.text();
        addLog(`❌ API Error: ${errorText}`);
      }
    } catch (error: any) {
      addLog(`🚨 Connection Error: ${error.message}`);
      addLog('💡 Possible issues:');
      addLog('  - Desktop app not running on port 3005');
      addLog('  - Network connectivity issues');
      addLog('  - IP address 10.0.0.24 not reachable');
    }
  };

  const testAuthentication = async () => {
    addLog('🔐 Testing authentication...');
    
    try {
      const result = await authAPI.checkAuth();
      addLog('✅ Authentication successful!');
      addLog(`👤 User: ${JSON.stringify(result, null, 2)}`);
      setIsAuthenticated(true);
    } catch (error: any) {
      addLog(`❌ Auth Error: ${error.message}`);
      setIsAuthenticated(false);
    }
  };

  const testLogin = async () => {
    addLog('📧 Testing login with demo credentials...');
    
    try {
      const result = await authAPI.login('demo@example.com', 'password');
      addLog('✅ Login successful!');
      addLog(`🎟️ Token received: ${result.token ? 'Yes' : 'No'}`);
      setIsAuthenticated(true);
    } catch (error: any) {
      addLog(`❌ Login Error: ${error.message}`);
    }
  };

  const testCaregivers = async () => {
    addLog('👥 Testing caregivers API...');
    
    try {
      const result = await caregiversAPI.getAll();
      addLog(`✅ Caregivers API successful!`);
      addLog(`📊 Found ${result.caregivers?.length || 0} caregivers`);
      
      if (result.caregivers?.length > 0) {
        addLog(`👨‍⚕️ Sample: ${result.caregivers[0].name || 'Unknown'}`);
      }
    } catch (error: any) {
      addLog(`❌ Caregivers Error: ${error.message}`);
    }
  };

  const testChat = async () => {
    addLog('💬 Testing chat API...');
    
    try {
      const result = await chatAPI.getRooms();
      addLog(`✅ Chat API successful!`);
      addLog(`📱 Found ${result.rooms?.length || 0} chat rooms`);
    } catch (error: any) {
      addLog(`❌ Chat Error: ${error.message}`);
    }
  };

  const clearLogs = () => {
    setLogs([]);
  };

  useEffect(() => {
    addLog('🚀 Debug Screen Loaded');
    addLog('🔧 API Base URL: http://10.0.0.24:3005/api');
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>API Debug</Text>
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.testButton} onPress={testAPIConnection}>
          <Text style={styles.buttonText}>Test API</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.testButton} onPress={testAuthentication}>
          <Text style={styles.buttonText}>Check Auth</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.testButton} onPress={testLogin}>
          <Text style={styles.buttonText}>Test Login</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity 
          style={[styles.testButton, !isAuthenticated && styles.disabledButton]} 
          onPress={testCaregivers}
          disabled={!isAuthenticated}
        >
          <Text style={styles.buttonText}>Caregivers</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.testButton, !isAuthenticated && styles.disabledButton]}
          onPress={testChat}
          disabled={!isAuthenticated}
        >
          <Text style={styles.buttonText}>Chat</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.clearButton} onPress={clearLogs}>
          <Text style={styles.buttonText}>Clear</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.logContainer} contentContainerStyle={styles.logContent}>
        {logs.map((log, index) => (
          <Text key={index} style={styles.logText}>
            {log}
          </Text>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.background,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
    color: colors.black,
  },
  buttonRow: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
  },
  testButton: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  clearButton: {
    flex: 1,
    backgroundColor: colors.gray,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: colors.gray,
    opacity: 0.5,
  },
  buttonText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  logContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  logContent: {
    padding: 16,
  },
  logText: {
    fontSize: 12,
    color: colors.black,
    marginBottom: 8,
    fontFamily: 'monospace',
  },
});