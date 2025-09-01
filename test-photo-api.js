const fetch = require('node-fetch');

async function testPhotoAPI() {
  try {
    // Test Isabella's photos
    const caregiverId = 'cmeoh6eon000cwmicy2w94m7t'; // Isabella's caregiver ID
    
    console.log(`🔍 Testing photo API for caregiver: ${caregiverId}`);
    console.log(`   URL: http://localhost:3000/api/caregiver/${caregiverId}/photos`);
    
    const response = await fetch(`http://localhost:3000/api/caregiver/${caregiverId}/photos`);
    const data = await response.json();
    
    console.log('\n📸 Response Status:', response.status);
    console.log('📸 Response Data:', JSON.stringify(data, null, 2));
    
    if (data.success && data.caregiver?.photos) {
      console.log(`\n✅ Found ${data.caregiver.photos.length} photos`);
      data.caregiver.photos.forEach(photo => {
        console.log(`   - ${photo.caption || 'No caption'} (${photo.url})`);
      });
    } else {
      console.log('\n⚠️ No photos found or API error');
    }
    
  } catch (error) {
    console.error('❌ Error testing API:', error);
  }
}

testPhotoAPI();