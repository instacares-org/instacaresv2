import { NextResponse } from "next/server";
import { prisma } from "@/lib/database";

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      where: {
        email: "farhadbills@gmail.com"
      },
      select: {
        id: true,
        email: true,
        name: true,
        userType: true,
        createdAt: true,
        accounts: {
          select: {
            provider: true,
            type: true,
          }
        }
      }
    });

    return NextResponse.json({
      found: users.length > 0,
      count: users.length,
      users: users
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to check user", details: error }, { status: 500 });
  }
}