import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import { api, setApiUser } from "./src/services/api";
import { connectSocket, disconnectSocket, getSocket } from "./src/services/socket";
import type { Message, User } from "./src/types";

const ROOM_ID = "general";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [username, setUsername] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [typingUser, setTypingUser] = useState("");
  const [otherOnline, setOtherOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flatListRef = useRef<FlatList<Message>>(null);

  const loadHistory = async (currentUser: User) => {
    try {
      const response = await api.get(`/api/messages/${ROOM_ID}`);
      const loaded: Message[] = (response.data.messages || []).map((m: any) => ({
        ...m,
        _id: String(m._id || m.id)
      }));
      setMessages(loaded);

      // Auto mark unread messages as delivered and read
      const socket = getSocket();
      for (const message of loaded) {
        if (message.senderId !== currentUser.id) {
          socket.emit("message_delivered", {
            messageId: message._id,
            userId: currentUser.id,
            roomId: ROOM_ID
          });
          socket.emit("message_read", {
            messageId: message._id,
            userId: currentUser.id,
            roomId: ROOM_ID
          });
        }
      }
    } catch (err: any) {
      console.error("Failed to load chat history:", err.message);
      setErrorMsg("Could not load history. Is the server running?");
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem("chat_user");
        if (saved) {
          const savedUser: User = JSON.parse(saved);
          setUser(savedUser);
          setApiUser(savedUser);
        }
      } catch (err) {
        console.error("Error reading saved user:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!user) return;

    let mounted = true;
    const socket = connectSocket();

    const handleConnect = () => {
      if (!mounted) return;
      setIsConnected(true);
      setErrorMsg("");
      socket.emit("join_room", {
        roomId: ROOM_ID,
        userId: user.id
      });
    };

    const handleDisconnect = () => {
      if (!mounted) return;
      setIsConnected(false);
    };

    const onReceive = (message: Message) => {
      if (!mounted) return;

      const formatted: Message = {
        ...message,
        _id: String(message._id || (message as any).id)
      };

      setMessages((previous) => {
        if (previous.some((item) => item._id === formatted._id)) return previous;
        return [...previous, formatted];
      });

      if (message.senderId !== user.id) {
        socket.emit("message_delivered", {
          messageId: formatted._id,
          userId: user.id,
          roomId: ROOM_ID
        });
        socket.emit("message_read", {
          messageId: formatted._id,
          userId: user.id,
          roomId: ROOM_ID
        });
      }
    };

    const onTyping = ({ userId, username: name }: { userId: string; username: string }) => {
      if (userId !== user.id) setTypingUser(name);
    };

    const onStopTyping = ({ userId }: { userId: string }) => {
      if (userId !== user.id) setTypingUser("");
    };

    const onStatus = ({
      messageId,
      status,
      userId
    }: {
      messageId: string;
      status: "delivered" | "read";
      userId: string;
    }) => {
      if (userId === user.id) {
        setMessages((previous) =>
          previous.map((message) => {
            if (message._id !== messageId) return message;
            if (status === "delivered") {
              return {
                ...message,
                deliveredTo: [...new Set([...(message.deliveredTo || []), user.id])]
              };
            }
            return {
              ...message,
              readBy: [...new Set([...(message.readBy || []), user.id])]
            };
          })
        );
      }
    };

    const onOnline = ({ userId }: { userId: string }) => {
      if (userId !== user.id) setOtherOnline(true);
    };

    const onOffline = ({ userId }: { userId: string }) => {
      if (userId !== user.id) setOtherOnline(false);
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("receive_message", onReceive);
    socket.on("user_typing", onTyping);
    socket.on("user_stopped_typing", onStopTyping);
    socket.on("message_status_updated", onStatus);
    socket.on("user_online", onOnline);
    socket.on("user_offline", onOffline);

    if (socket.connected) {
      handleConnect();
    }

    loadHistory(user).catch(console.error);

    return () => {
      mounted = false;
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("receive_message", onReceive);
      socket.off("user_typing", onTyping);
      socket.off("user_stopped_typing", onStopTyping);
      socket.off("message_status_updated", onStatus);
      socket.off("user_online", onOnline);
      socket.off("user_offline", onOffline);
      disconnectSocket();
    };
  }, [user]);

  const login = async () => {
    const clean = username.trim();
    if (clean.length < 2) {
      setErrorMsg("Username must be at least 2 characters.");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    try {
      const response = await api.post("/api/users/login", { username: clean });
      const loggedUser: User = response.data.user;
      await AsyncStorage.setItem("chat_user", JSON.stringify(loggedUser));
      setApiUser(loggedUser);
      setUser(loggedUser);
    } catch (error: any) {
      console.error(error);
      setErrorMsg(
        error.response?.data?.message || "Unable to join. Is the backend server running?"
      );
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    disconnectSocket();
    await AsyncStorage.removeItem("chat_user");
    setUser(null);
    setMessages([]);
    setErrorMsg("");
    setOtherOnline(false);
    setTypingUser("");
  };

  const sendMessage = () => {
    const clean = text.trim();
    if (!clean || !user || sending) return;

    setSending(true);
    const socket = getSocket();

    socket.emit(
      "send_message",
      {
        roomId: ROOM_ID,
        senderId: user.id,
        senderName: user.username,
        text: clean
      },
      (response: { ok: boolean; message?: string }) => {
        setSending(false);
        if (response?.ok) {
          setText("");
          socket.emit("stop_typing", {
            roomId: ROOM_ID,
            userId: user.id
          });
        } else {
          console.error(response?.message);
        }
      }
    );
  };

  const handleTyping = (value: string) => {
    setText(value);
    if (!user) return;

    const socket = getSocket();
    socket.emit("typing", {
      roomId: ROOM_ID,
      userId: user.id,
      username: user.username
    });

    if (typingTimer.current) clearTimeout(typingTimer.current);

    typingTimer.current = setTimeout(() => {
      socket.emit("stop_typing", {
        roomId: ROOM_ID,
        userId: user.id
      });
    }, 1200);
  };

  const handleKeyPress = (e: any) => {
    if (Platform.OS === "web" && e.nativeEvent.key === "Enter" && !e.nativeEvent.shiftKey) {
      e.preventDefault?.();
      sendMessage();
    }
  };

  const sortedMessages = useMemo(() => messages, [messages]);

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.muted}>Loading chat...</Text>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.loginContainer}>
        <StatusBar style="dark" />
        <View style={styles.loginWrapper}>
          <View style={styles.loginCard}>
            <View style={styles.logoBadge}>
              <Text style={styles.logoBadgeText}>💬</Text>
            </View>
            <Text style={styles.logo}>Real-Time Chat</Text>
            <Text style={styles.subtitle}>
              Powered by Node.js + Socket.io + React Native
            </Text>

            {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

            <Text style={styles.label}>Choose your username</Text>
            <TextInput
              value={username}
              onChangeText={(val) => {
                setUsername(val);
                setErrorMsg("");
              }}
              placeholder="e.g. Alex, Maria, DevExpert"
              placeholderTextColor="#9ca3af"
              autoCapitalize="none"
              style={styles.input}
              onSubmitEditing={login}
            />

            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && { opacity: 0.85 }
              ]}
              onPress={login}
            >
              <Text style={styles.primaryButtonText}>Join Chat Room</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.appWrapper}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.roomAvatar}>
                <Text style={styles.roomAvatarText}>#</Text>
              </View>
              <View>
                <View style={styles.titleRow}>
                  <Text style={styles.headerTitle}>General Chat</Text>
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: isConnected ? "#10b981" : "#f59e0b" }
                    ]}
                  />
                </View>
                <Text style={styles.headerStatus}>
                  {typingUser
                    ? `✍️ ${typingUser} is typing...`
                    : otherOnline
                    ? "🟢 Users online in room"
                    : isConnected
                    ? "Online • Ready to chat"
                    : "Connecting to server..."}
                </Text>
              </View>
            </View>

            <View style={styles.headerRight}>
              <View style={styles.userBadge}>
                <Text style={styles.userBadgeText}>{user.username}</Text>
              </View>
              <Pressable onPress={logout} style={styles.logoutButton}>
                <Text style={styles.logout}>Logout</Text>
              </Pressable>
            </View>
          </View>

          {errorMsg ? (
            <View style={styles.bannerError}>
              <Text style={styles.bannerErrorText}>{errorMsg}</Text>
            </View>
          ) : null}

          {/* Messages List */}
          <FlatList
            ref={flatListRef}
            data={sortedMessages}
            keyExtractor={(item) => item._id}
            contentContainerStyle={styles.messages}
            onContentSizeChange={() =>
              flatListRef.current?.scrollToEnd({ animated: true })
            }
            onLayout={() =>
              flatListRef.current?.scrollToEnd({ animated: false })
            }
            renderItem={({ item }) => {
              const mine = item.senderId === user.id;
              const read = (item.readBy || []).length > 0;
              const delivered = (item.deliveredTo || []).length > 0;

              return (
                <View style={[styles.messageRow, mine && styles.myRow]}>
                  {!mine && (
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {(item.senderName || "U").slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View
                    style={[
                      styles.bubble,
                      mine ? styles.myBubble : styles.otherBubble
                    ]}
                  >
                    {!mine && (
                      <Text style={styles.sender}>{item.senderName}</Text>
                    )}
                    <Text
                      style={[
                        styles.messageText,
                        mine && styles.myMessageText
                      ]}
                    >
                      {item.text}
                    </Text>
                    <View style={styles.meta}>
                      <Text style={[styles.time, mine && styles.myTime]}>
                        {new Date(item.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </Text>
                      {mine && (
                        <Text style={styles.checks}>
                          {read ? "✓✓" : delivered ? "✓✓" : "✓"}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyEmoji}>💬</Text>
                <Text style={styles.emptyTitle}>No messages yet</Text>
                <Text style={styles.muted}>
                  Be the first one to say hello in #general!
                </Text>
              </View>
            }
          />

          {/* Typing indicator bar */}
          {typingUser ? (
            <View style={styles.typingBar}>
              <Text style={styles.typingBarText}>
                ✍️ <Text style={{ fontWeight: "700" }}>{typingUser}</Text> is typing...
              </Text>
            </View>
          ) : null}

          {/* Composer */}
          <View style={styles.composer}>
            <TextInput
              value={text}
              onChangeText={handleTyping}
              placeholder="Type a message... (Press Enter to send)"
              placeholderTextColor="#9ca3af"
              multiline
              onKeyPress={handleKeyPress}
              style={styles.messageInput}
            />
            <Pressable
              onPress={sendMessage}
              disabled={sending || !text.trim()}
              style={({ pressed }) => [
                styles.sendButton,
                (sending || !text.trim()) && styles.disabledButton,
                pressed && { opacity: 0.85 }
              ]}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.sendText}>Send</Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#f1f5f9"
  },
  appWrapper: {
    flex: 1,
    width: "100%",
    maxWidth: Platform.OS === "web" ? 760 : undefined,
    alignSelf: "center",
    backgroundColor: "#ffffff",
    ...(Platform.OS === "web"
      ? {
          shadowColor: "#000",
          shadowOpacity: 0.05,
          shadowRadius: 15,
          borderLeftWidth: 1,
          borderRightWidth: 1,
          borderColor: "#e2e8f0"
        }
      : {})
  },
  container: {
    flex: 1,
    backgroundColor: "#f8fafc"
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "#f8fafc"
  },
  loginContainer: {
    flex: 1,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    padding: 20
  },
  loginWrapper: {
    width: "100%",
    maxWidth: 440,
    alignSelf: "center"
  },
  loginCard: {
    backgroundColor: "#ffffff",
    padding: 32,
    borderRadius: 24,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 4,
    borderWidth: 1,
    borderColor: "#e2e8f0"
  },
  logoBadge: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16
  },
  logoBadgeText: {
    fontSize: 28
  },
  logo: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.5
  },
  subtitle: {
    marginTop: 6,
    marginBottom: 24,
    color: "#64748b",
    fontSize: 14,
    lineHeight: 20
  },
  label: {
    fontWeight: "700",
    marginBottom: 8,
    color: "#334155",
    fontSize: 14
  },
  input: {
    borderWidth: 1.5,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    backgroundColor: "#f8fafc",
    color: "#0f172a",
    marginBottom: 16
  },
  errorText: {
    color: "#ef4444",
    backgroundColor: "#fee2e2",
    padding: 10,
    borderRadius: 8,
    fontSize: 13,
    marginBottom: 14
  },
  primaryButton: {
    backgroundColor: "#2563eb",
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center"
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 16
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  roomAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#dbeafe",
    alignItems: "center",
    justifyContent: "center"
  },
  roomAvatarText: {
    fontSize: 20,
    fontWeight: "800",
    color: "#2563eb"
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a"
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  headerStatus: {
    marginTop: 2,
    color: "#64748b",
    fontSize: 12,
    fontWeight: "500"
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  userBadge: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12
  },
  userBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155"
  },
  logoutButton: {
    paddingVertical: 4,
    paddingHorizontal: 6
  },
  logout: {
    color: "#ef4444",
    fontWeight: "700",
    fontSize: 13
  },
  bannerError: {
    backgroundColor: "#fee2e2",
    padding: 8,
    alignItems: "center"
  },
  bannerErrorText: {
    color: "#b91c1c",
    fontSize: 12,
    fontWeight: "600"
  },
  messages: {
    padding: 16,
    paddingBottom: 20
  },
  messageRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 14,
    gap: 8
  },
  myRow: {
    justifyContent: "flex-end"
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#cbd5e1",
    alignItems: "center",
    justifyContent: "center"
  },
  avatarText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#334155"
  },
  bubble: {
    maxWidth: "80%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1
  },
  myBubble: {
    backgroundColor: "#2563eb",
    borderBottomRightRadius: 4
  },
  otherBubble: {
    backgroundColor: "#ffffff",
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: "#e2e8f0"
  },
  sender: {
    fontWeight: "800",
    color: "#2563eb",
    marginBottom: 3,
    fontSize: 12
  },
  messageText: {
    fontSize: 15,
    color: "#0f172a",
    lineHeight: 21
  },
  myMessageText: {
    color: "#ffffff"
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 5,
    marginTop: 4
  },
  time: {
    fontSize: 10,
    color: "#94a3b8"
  },
  myTime: {
    color: "#bfdbfe"
  },
  checks: {
    fontSize: 10,
    color: "#bfdbfe",
    fontWeight: "800"
  },
  empty: {
    alignItems: "center",
    marginTop: 80
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: 10
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 4
  },
  muted: {
    color: "#64748b",
    fontSize: 13
  },
  typingBar: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    backgroundColor: "transparent"
  },
  typingBarText: {
    fontSize: 12,
    color: "#64748b",
    fontStyle: "italic"
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 12,
    gap: 10,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0"
  },
  messageInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 110,
    backgroundColor: "#f1f5f9",
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 11,
    paddingBottom: 11,
    fontSize: 15,
    color: "#0f172a"
  },
  sendButton: {
    backgroundColor: "#2563eb",
    borderRadius: 22,
    height: 44,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center"
  },
  disabledButton: {
    opacity: 0.45
  },
  sendText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 14
  }
});
