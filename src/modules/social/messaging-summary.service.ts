import type { User } from "../../../generated/prisma/client.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { ConversationService } from "./conversation.service.js";
import { GroupChatService } from "../groups/group-chat.service.js";
import { MessageRequestService } from "./message-request.service.js";
import type { MessagingSummaryDto } from "./social.dto.js";

export class MessagingSummaryService {
  private readonly conversations: ConversationService;
  private readonly groupChats: GroupChatService;
  private readonly messageRequests: MessageRequestService;

  constructor(db: DatabaseClient) {
    this.conversations = new ConversationService(db);
    this.groupChats = new GroupChatService(db);
    this.messageRequests = new MessageRequestService(db);
  }

  async getSummary(viewer: User): Promise<MessagingSummaryDto> {
    const [direct, group, messageRequestsPending] = await Promise.all([
      this.conversations.summarizeUnread(viewer),
      this.groupChats.summarizeUnread(viewer),
      this.messageRequests.countPendingInbox(viewer),
    ]);

    const directUnread = direct.unreadMessages;
    const groupUnread = group.unreadMessages;
    const totalUnreadMessages = directUnread + groupUnread;

    return {
      directUnread,
      groupUnread,
      messageRequestsPending,
      totalUnreadMessages,
      displayBadgeCount: totalUnreadMessages,
      directConversationsWithUnread: direct.conversationsWithUnread,
      groupChatsWithUnread: group.groupChatsWithUnread,
    };
  }
}
