import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash("Password123", 10);

  const users = await Promise.all(
    [
      { name: "Harsha Vardhan", username: "harsha", email: "harsha@example.com" },
      { name: "Rahul Sharma", username: "rahul", email: "rahul@example.com" },
      { name: "Akhil Kumar", username: "akhil", email: "akhil@example.com" },
      { name: "Kiran Reddy", username: "kiran", email: "kiran@example.com" },
      { name: "Divya Patel", username: "divya", email: "divya@example.com" },
    ].map((u) => prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, passwordHash: password, isVerified: true },
    })),
  );

  const [harsha, rahul, akhil, kiran, divya] = users;

  const projectTeam = await prisma.chat.create({
    data: {
      chatId: "CH-8F92KD",
      name: "Project Team",
      description: "Development team",
      ownerId: harsha.id,
      maxMembers: 10,
      accessType: "APPROVAL_REQUIRED",
      members: {
        create: [
          { userId: harsha.id, role: "OWNER" },
          { userId: rahul.id, role: "MEMBER" },
          { userId: akhil.id, role: "ADMIN" },
        ],
      },
    },
  });

  const hackathon = await prisma.chat.create({
    data: {
      chatId: "CH-7A3P9M",
      name: "Hackathon Team",
      description: "48hr build",
      ownerId: rahul.id,
      maxMembers: 5,
      accessType: "PUBLIC",
      members: {
        create: [
          { userId: rahul.id, role: "OWNER" },
          { userId: kiran.id, role: "MEMBER" },
          { userId: divya.id, role: "MEMBER" },
        ],
      },
    },
  });

  const inviteOnly = await prisma.chat.create({
    data: {
      chatId: "CH-2Q7XZT",
      name: "Leadership Sync",
      description: "Invite-only",
      ownerId: kiran.id,
      maxMembers: 4,
      accessType: "INVITE_ONLY",
      members: { create: [{ userId: kiran.id, role: "OWNER" }] },
    },
  });

  await prisma.message.createMany({
    data: [
      { chatId: projectTeam.id, senderId: rahul.id, content: "Hey, are you coming?", messageType: "TEXT" },
      { chatId: projectTeam.id, senderId: akhil.id, content: "Completed 👍", messageType: "TEXT" },
      { chatId: hackathon.id, senderId: kiran.id, content: "Pushed the initial commit", messageType: "TEXT" },
    ],
  });

  await prisma.notification.create({
    data: {
      recipientId: harsha.id,
      type: "JOIN_REQUEST",
      payload: { chatId: inviteOnly.chatId, fromUser: divya.username },
    },
  });

  console.log("Seed complete:", { users: users.length, chats: [projectTeam.chatId, hackathon.chatId, inviteOnly.chatId] });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
