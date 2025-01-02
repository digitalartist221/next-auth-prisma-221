import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import prisma from "@/prisma/prisma";
import { createUserSchema } from "@/lib/user-schema";
import { ZodError } from "zod";

export async function POST(req: Request) {
  try {
    const { name, email, password } = createUserSchema.parse(await req.json());
    const hashed_password = await hash(password, 12);

    // Vérifier s'il existe déjà un rôle "Admin"
    let adminRole = await prisma.role.findFirst({
      where: { name: "Admin" },
    });

    // Créer le rôle "Admin" s'il n'existe pas
    if (!adminRole) {
      adminRole = await prisma.role.create({
        data: { name: "Admin" },
      });
    }

    // Vérifier s'il existe déjà un rôle "User"
    let userRole = await prisma.role.findFirst({
      where: { name: "User" },
    });

    // Créer le rôle "User" s'il n'existe pas
    if (!userRole) {
      userRole = await prisma.role.create({
        data: { name: "User" },
      });
    }

    // Vérifier si c'est le premier utilisateur
    const userCount = await prisma.user.count();

    // Créer l'utilisateur avec le rôle approprié
    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        password: hashed_password,
        roleId: userCount === 0 ? adminRole.id : userRole.id, // Rôle "Admin" pour le premier utilisateur, sinon "User"
      },
    });

    return NextResponse.json({
      user: {
        name: user.name,
        email: user.email,
        role: userCount === 0 ? "Admin" : "User",
      },
    });
  } catch (error: any) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          status: "error",
          message: "Validation failed",
          errors: error.errors,
        },
        { status: 400 }
      );
    }

    if (error.code === "P2002") {
      return NextResponse.json(
        {
          status: "fail",
          message: "User with that email already exists",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        status: "error",
        message: error.message || "Internal Server Error",
      },
      { status: 500 }
    );
  }
}
