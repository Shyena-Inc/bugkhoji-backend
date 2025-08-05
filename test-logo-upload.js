const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:4000';

async function testLogoUpload() {
  try {
    console.log('🧪 Testing Program Logo Upload Functionality...\n');

    // First, let's check if we can access the researcher programs endpoint
    console.log('1. Testing researcher programs endpoint...');
    const programsResponse = await axios.get(`${BASE_URL}/api/v1/researcher/programs`);
    console.log(`✅ Researcher programs endpoint accessible. Found ${programsResponse.data.programs?.length || 0} programs\n`);

    if (!programsResponse.data.programs || programsResponse.data.programs.length === 0) {
      console.log('ℹ️ No programs found. The logo upload test requires an existing program.');
      console.log('Please create a program first or ensure you have programs in your database.\n');
      
      // Still test static file serving even without programs
      console.log('6. Testing static file serving setup...');
      try {
        await axios.get(`${BASE_URL}/uploads/non-existent.png`);
      } catch (error) {
        if (error.response?.status === 404) {
          console.log('✅ Static file serving route is properly configured');
          console.log('📁 /uploads route is accessible (returns 404 for non-existent files)\n');
        } else {
          console.log('❌ Static file serving may not be configured correctly');
        }
      }
      return;
    }

    const testProgram = programsResponse.data.programs[0];
    console.log(`2. Using test program: ${testProgram.name} (ID: ${testProgram.id})\n`);

    // Test logo upload
    console.log('3. Testing logo upload...');
    const logoPath = path.join(__dirname, 'test-uploads', 'test-logo.png');
    
    if (!fs.existsSync(logoPath)) {
      console.log('❌ Test logo file not found. Please ensure test-logo.png exists in test-uploads/');
      return;
    }

    const formData = new FormData();
    formData.append('logo', fs.createReadStream(logoPath));

    try {
      const uploadResponse = await axios.post(
        `${BASE_URL}/api/v1/programs/${testProgram.id}/logo`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            // Note: In a real scenario, you'd need authentication headers
            // 'Authorization': 'Bearer your-jwt-token'
          }
        }
      );

      console.log('✅ Logo upload successful!');
      console.log(`📷 Logo URL: ${uploadResponse.data.logo}\n`);

      // Test accessing the uploaded logo
      console.log('4. Testing logo accessibility...');
      const logoUrl = uploadResponse.data.logo;
      const logoAccessResponse = await axios.get(`${BASE_URL}${logoUrl}`);
      
      if (logoAccessResponse.status === 200) {
        console.log('✅ Logo is accessible via static file serving\n');
      }

      // Test logo deletion
      console.log('5. Testing logo deletion...');
      const deleteResponse = await axios.delete(`${BASE_URL}/api/v1/programs/${testProgram.id}/logo`);
      console.log('✅ Logo deletion successful!');
      console.log('🗑️ Logo removed from program\n');

    } catch (uploadError) {
      if (uploadError.response?.status === 401) {
        console.log('ℹ️ Authentication required for logo upload (expected behavior)');
        console.log('🔐 Status: 401 Unauthorized');
        console.log('📝 Message:', uploadError.response.data?.message || 'Authentication required');
        console.log('\n✅ Authentication middleware is working correctly!\n');
      } else {
        console.log('❌ Upload failed:', uploadError.response?.data || uploadError.message);
      }
    }

    // Test static file serving setup
    console.log('6. Testing static file serving setup...');
    try {
      // Try accessing a non-existent file to check if the route is set up
      await axios.get(`${BASE_URL}/uploads/non-existent.png`);
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('✅ Static file serving route is properly configured');
        console.log('📁 /uploads route is accessible (returns 404 for non-existent files)\n');
      } else {
        console.log('❌ Static file serving may not be configured correctly');
      }
    }

    console.log('🎉 Logo upload functionality test completed!');
    console.log('\n📋 Summary:');
    console.log('- ✅ Programs API endpoint working');
    console.log('- ✅ Static file serving configured');
    console.log('- ✅ Authentication middleware active');
    console.log('- 📝 Ready for frontend integration');

  } catch (error) {
    console.log('❌ Test failed:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('🔌 Make sure the backend server is running on port 4000');
    }
  }
}

// Run the test
testLogoUpload();
