import { NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { db } from '@/lib/db';

import { features } from '@/lib/config/features';
import { requireFirebaseUser } from '@/lib/auth/require-firebase-user';

if (features.KYC_ENABLED) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

export async function POST(request: Request) {
  if (!features.KYC_ENABLED) {
    return NextResponse.json({ error: 'KYC feature is currently disabled.' }, { status: 403 });
  }

  try {
    const authenticatedUser = await requireFirebaseUser(request);
    const formData = await request.formData();
    const userId = authenticatedUser.uid;
    const documentType = formData.get('documentType') as string;
    const file = formData.get('file') as File;

    if (!userId || !documentType || !file) {
      return NextResponse.json({ error: 'Missing required KYC fields' }, { status: 400 });
    }

    // Prepare real upload to Cloudinary using ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // This will throw if Cloudinary credentials are mock/invalid
    const uploadResult = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { folder: 'securechain/kyc', resource_type: 'auto' },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      ).end(buffer);
    }) as any;

    // Securely record the document in PostgreSQL (assuming user exists)
    // Upsert since a user might re-upload their KYC
    const kycDoc = await db.kycDocument.upsert({
      where: { userId: userId },
      update: {
        documentType,
        documentUrl: uploadResult.secure_url,
        status: 'PENDING',
        uploadedAt: new Date(),
      },
      create: {
        userId,
        documentType,
        documentUrl: uploadResult.secure_url,
        status: 'PENDING'
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Document securely uploaded and recorded',
      kycRecordId: kycDoc.id
    });
  } catch (error: any) {
    console.error('Real KYC upload error:', error);
    return NextResponse.json({ 
      error: 'Upload failed. Check Cloudinary API keys and DB connection.' 
    }, { status: error.status || 500 });
  }
}
