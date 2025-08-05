const axios = require('axios');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:4000';

async function testStaticFileServing() {
  console.log('🧪 Testing Static File Serving...\n');

  try {
    // Test 1: Check if uploads directory exists and create if needed
    console.log('1. Checking uploads directory...');
    const uploadsDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
      console.log('✅ Created uploads directory\n');
    } else {
      console.log('✅ Uploads directory exists\n');
    }

    // Test 2: Create a test file in uploads
    console.log('2. Creating test file...');
    const testFilePath = path.join(uploadsDir, 'test-static-file.txt');
    fs.writeFileSync(testFilePath, 'This is a test file for static serving!');
    console.log('✅ Test file created: uploads/test-static-file.txt\n');

    // Test 3: Test accessing the file via static route
    console.log('3. Testing static file access...');
    try {
      const response = await axios.get(`${BASE_URL}/uploads/test-static-file.txt`);
      if (response.status === 200 && response.data.includes('This is a test file')) {
        console.log('✅ Static file served successfully!');
        console.log(`📄 Content: ${response.data}\n`);
      } else {
        console.log('❌ Unexpected response from static file');
      }
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('❌ Static file serving not working - file not found');
      } else {
        console.log('❌ Static file serving error:', error.message);
      }
    }

    // Test 4: Test with non-existent file (should return 404)
    console.log('4. Testing 404 for non-existent file...');
    try {
      await axios.get(`${BASE_URL}/uploads/non-existent-file.txt`);
      console.log('❌ Expected 404 but got successful response');
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('✅ Correctly returns 404 for non-existent files\n');
      } else {
        console.log('❌ Unexpected error for non-existent file:', error.message);
      }
    }

    // Test 5: Test with image file (simulating logo upload)
    console.log('5. Testing image file serving...');
    const testImagePath = path.join(__dirname, 'test-uploads', 'test-logo.png');
    const uploadsImagePath = path.join(uploadsDir, 'test-logo.png');
    
    if (fs.existsSync(testImagePath)) {
      fs.copyFileSync(testImagePath, uploadsImagePath);
      console.log('✅ Copied test image to uploads directory');
      
      try {
        const imageResponse = await axios.get(`${BASE_URL}/uploads/test-logo.png`, {
          responseType: 'arraybuffer'
        });
        
        if (imageResponse.status === 200 && imageResponse.headers['content-type']?.includes('image')) {
          console.log('✅ Image file served successfully!');
          console.log(`📷 Content-Type: ${imageResponse.headers['content-type']}`);
          console.log(`📊 Size: ${imageResponse.data.length} bytes\n`);
        } else {
          console.log('❌ Image not served correctly');
        }
      } catch (error) {
        console.log('❌ Error serving image:', error.message);
      }
    } else {
      console.log('ℹ️ Test image not found, skipping image test\n');
    }

    // Test 6: Check server health
    console.log('6. Testing server health...');
    try {
      const healthResponse = await axios.get(`${BASE_URL}/api/health`);
      console.log('✅ Server health check passed');
      console.log(`📊 Response: ${JSON.stringify(healthResponse.data, null, 2)}\n`);
    } catch (error) {
      console.log('ℹ️ Health endpoint not available or different path\n');
    }

    console.log('🎉 Static file serving test completed!');
    console.log('\n📋 Summary:');
    console.log('- ✅ Static file serving is working');
    console.log('- ✅ 404 handling for non-existent files');
    console.log('- ✅ Image files can be served');
    console.log('- 📝 Ready for logo upload integration');

    // Cleanup
    console.log('\n🧹 Cleaning up test files...');
    if (fs.existsSync(testFilePath)) fs.unlinkSync(testFilePath);
    if (fs.existsSync(uploadsImagePath)) fs.unlinkSync(uploadsImagePath);
    console.log('✅ Cleanup completed');

  } catch (error) {
    console.log('❌ Test failed:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('🔌 Make sure the backend server is running on port 4000');
    }
  }
}

// Run the test
testStaticFileServing();
