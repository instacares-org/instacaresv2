import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';

export const alt = 'InstaCares - Trusted Childcare in Canada';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #e11d48 0%, #f97316 100%)',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '20px',
          }}
        >
          <div
            style={{
              fontSize: 80,
              fontWeight: 'bold',
              color: 'white',
              letterSpacing: '-2px',
            }}
          >
            InstaCares
          </div>
          <div
            style={{
              fontSize: 36,
              color: 'rgba(255, 255, 255, 0.9)',
            }}
          >
            Find Trusted Childcare in Canada
          </div>
          <div
            style={{
              width: 200,
              height: 2,
              background: 'rgba(255, 255, 255, 0.4)',
              marginTop: 20,
            }}
          />
          <div
            style={{
              fontSize: 22,
              color: 'rgba(255, 255, 255, 0.7)',
              marginTop: 10,
            }}
          >
            Verified Babysitters & Caregivers Near You
          </div>
          <div
            style={{
              fontSize: 18,
              color: 'rgba(255, 255, 255, 0.5)',
              marginTop: 10,
            }}
          >
            instacares.net
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
