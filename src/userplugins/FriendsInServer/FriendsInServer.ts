/*
 * FriendsInServer - A Vencord plugin to check which friends are in the current server
 * 
 * This plugin adds a "Friends In Server" button to the server header
 * that shows a modal listing all friends who are members of the current server.
 */

import { findByProps, findByPropsLazy } from "@webpack";
import { Devs } from "@utils/constants";
import { definePlugin } from "@utils/types";
import { Button, Tooltip, Modal, Text, ErrorBoundary } from "@components/";
import { openModal, closeModal } from "@utils/modal";
import { useEffect, useState } from "react";

// Get Discord stores through Webpack
const RelationshipStore = findByPropsLazy("getRelationships", "isFriend");
const GuildMemberStore = findByPropsLazy("getMember", "getMembers");
const UserStore = findByPropsLazy("getUser", "getUsers");
const SelectedGuildStore = findByPropsLazy("getLastSelectedGuildId");

// Modal component to display friends in the current server
function FriendsInServerModal({ modalKey, guildId }) {
    const [friends, setFriends] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Get all friends
        const relationships = RelationshipStore.getRelationships();
        const friendIds = Object.entries(relationships)
            .filter(([_, type]) => type === 1)
            .map(([userId]) => userId);

        // Get all members in the current server
        const members = GuildMemberStore.getMembers(guildId);
        
        // Find friends who are also in the server
        const friendsInServer = friendIds
            .filter(friendId => members[friendId])
            .map(friendId => {
                const user = UserStore.getUser(friendId);
                return {
                    id: friendId,
                    username: user?.username || "Unknown User",
                    discriminator: user?.discriminator || "0000",
                    avatar: user?.avatar,
                    tag: user?.discriminator ? `${user.username}#${user.discriminator}` : user?.username
                };
            });

        setFriends(friendsInServer);
        setLoading(false);
    }, [guildId]);

    return (
        <Modal.ModalRoot modalKey={modalKey}>
            <Modal.ModalHeader>
                <Text variant="heading-lg/semibold">Friends In This Server</Text>
                <Modal.ModalCloseButton onClick={() => closeModal(modalKey)} />
            </Modal.ModalHeader>
            <Modal.ModalContent>
                {loading ? (
                    <div style={{ padding: "16px", textAlign: "center" }}>
                        <Text>Loading friends...</Text>
                    </div>
                ) : friends.length > 0 ? (
                    <div style={{ padding: "8px 16px", maxHeight: "400px", overflowY: "auto" }}>
                        {friends.map(friend => (
                            <div key={friend.id} style={{ 
                                padding: "8px 0", 
                                display: "flex", 
                                alignItems: "center",
                                borderBottom: "1px solid var(--background-modifier-accent)"
                            }}>
                                <img 
                                    src={friend.avatar ? 
                                        `https://cdn.discordapp.com/avatars/${friend.id}/${friend.avatar}.png?size=32` : 
                                        `https://cdn.discordapp.com/embed/avatars/${parseInt(friend.discriminator) % 5}.png`
                                    } 
                                    style={{ 
                                        width: "32px", 
                                        height: "32px", 
                                        borderRadius: "50%", 
                                        marginRight: "12px" 
                                    }} 
                                    alt={friend.username}
                                />
                                <Text>{friend.tag}</Text>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div style={{ padding: "16px", textAlign: "center" }}>
                        <Text>None of your friends are in this server.</Text>
                    </div>
                )}
            </Modal.ModalContent>
            <Modal.ModalFooter>
                <Text variant="text-sm/normal" style={{ marginRight: "auto" }}>
                    Found {friends.length} friend{friends.length !== 1 ? "s" : ""} in this server
                </Text>
                <Button onClick={() => closeModal(modalKey)}>
                    Close
                </Button>
            </Modal.ModalFooter>
        </Modal.ModalRoot>
    );
}

export default definePlugin({
    name: "FriendsInServer",
    description: "Adds a button to check which friends are in the current server",
    authors: [Devs.Dawok],
    
    patches: [
        {
            find: ".HEADER_BAR_BADGE,",
            replacement: {
                match: /(\w+)=(.{1,50}\.useMemo\(\(\)=>\[.{1,300})\]/,
                replace: "$1=$2,this.renderFriendsInServerButton()]"
            }
        }
    ],

    renderFriendsInServerButton() {
        const guildId = SelectedGuildStore.getLastSelectedGuildId();
        
        if (!guildId) return null; // Not in a server
        
        return (
            <ErrorBoundary>
                <Tooltip text="Show Friends In Server">
                    <Button
                        look={Button.Looks.BLANK}
                        size={Button.Sizes.NONE}
                        onClick={() => {
                            const key = openModal(props => (
                                <FriendsInServerModal 
                                    modalKey={props.modalKey} 
                                    guildId={guildId} 
                                />
                            ));
                        }}
                        style={{
                            margin: "0 8px"
                        }}
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24">
                            <path 
                                fill="currentColor" 
                                d="M8.3 12.8c0-1 .8-1.8 1.8-1.8s1.8.8 1.8 1.8-.8 1.8-1.8 1.8-1.8-.8-1.8-1.8zm6.3 0c0-1 .8-1.8 1.8-1.8s1.8.8 1.8 1.8-.8 1.8-1.8 1.8-1.8-.8-1.8-1.8zM18.3 5.9C16.9 4.8 15.3 4 12 4s-4.9.8-6.3 1.9C4.3 6.9 3 8.7 3 12c0 3.3 1.3 5.1 2.7 6.1C7.1 19.2 8.7 20 12 20s4.9-.8 6.3-1.9c1.4-1 2.7-2.8 2.7-6.1 0-3.3-1.3-5.1-2.7-6.1zM12 18c-6 0-7-4.3-7-6s1-6 7-6 7 4.3 7 6-1 6-7 6z" 
                            />
                        </svg>
                    </Button>
                </Tooltip>
            </ErrorBoundary>
        );
    },

    start() {},
    stop() {}
});