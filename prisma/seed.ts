import "dotenv/config";
import { asJson, prisma } from "../lib/prisma";
import { markdownToDoc } from "../lib/markdown";
import { docToPlainText } from "../lib/doc";

/**
 * Seeded reviewer accounts. Mocked auth means no passwords — the sign-in page
 * lists these and sets a cookie. Emails are stable so the share flow can be
 * demonstrated by typing a known address.
 */
const USERS = [
  { email: "ava@ajaia.test", name: "Ava Chen" },
  { email: "ben@ajaia.test", name: "Ben Okafor" },
  { email: "cleo@ajaia.test", name: "Cleo Marsh" },
];

const WELCOME = `# Welcome to Ajaia Docs

This is a seeded document so reviewers have something to open immediately.

## What works
- Rich text: **bold**, *italic*, <u>underline</u>, headings, bullet and numbered lists
- Autosave on a short debounce, so a refresh keeps your content
- Import a \`.txt\`, \`.md\`, or \`.docx\` file as a new document or into this one
- Share with another seeded user as a viewer or an editor

## Try this
1. Edit this line and refresh the page
2. Open Share and grant **ben@ajaia.test** editor access
3. Sign in as Ben and confirm it appears under Shared with me
`;

const NOTES = `# Q3 planning notes

Rough notes, shared read-only.

- Ship the editor slice first
- Sharing model before real auth
- Deployment early, not last

> Partial work that is explained beats a broken full build.
`;

async function main() {
  const users = [];
  for (const u of USERS) {
    users.push(
      await prisma.user.upsert({
        where: { email: u.email },
        update: { name: u.name },
        create: u,
      }),
    );
  }
  const [ava, ben] = users;

  // Idempotent: re-running the seed refreshes the demo docs rather than piling
  // up duplicates.
  await prisma.document.deleteMany({
    where: { title: { in: ["Welcome to Ajaia Docs", "Q3 planning notes"] } },
  });

  const welcomeDoc = markdownToDoc(WELCOME);
  const welcome = await prisma.document.create({
    data: {
      title: "Welcome to Ajaia Docs",
      content: asJson(welcomeDoc),
      plainText: docToPlainText(welcomeDoc),
      ownerId: ava.id,
    },
  });

  const notesDoc = markdownToDoc(NOTES);
  const notes = await prisma.document.create({
    data: {
      title: "Q3 planning notes",
      content: asJson(notesDoc),
      plainText: docToPlainText(notesDoc),
      ownerId: ava.id,
    },
  });

  await prisma.share.create({
    data: { documentId: welcome.id, userId: ben.id, role: "EDITOR" },
  });
  await prisma.share.create({
    data: { documentId: notes.id, userId: ben.id, role: "VIEWER" },
  });

  console.log(
    `Seeded ${users.length} users, 2 documents, 2 shares (Ben has editor on Welcome, viewer on Q3).`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
