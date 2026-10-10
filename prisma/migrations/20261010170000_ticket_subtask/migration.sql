-- CreateEnum
CREATE TYPE "SubtaskStatus" AS ENUM ('TODO', 'DOING', 'DONE');

-- CreateTable
CREATE TABLE "TicketSubtask" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "SubtaskStatus" NOT NULL DEFAULT 'TODO',
    "assigneeId" TEXT,
    "dueDate" DATE,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketSubtask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TicketSubtask_ticketId_sortOrder_idx" ON "TicketSubtask"("ticketId", "sortOrder");

-- AddForeignKey
ALTER TABLE "TicketSubtask" ADD CONSTRAINT "TicketSubtask_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "CooperationTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketSubtask" ADD CONSTRAINT "TicketSubtask_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
