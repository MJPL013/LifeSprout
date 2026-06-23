import { MessageSquare } from 'lucide-react';

function stripDecorativeEmoji(text) {
    return String(text || '')
        .replace(/[\p{Extended_Pictographic}\uFE0F]/gu, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

export default function RoomFeed({ feed, user }) {
    if (!feed || feed.length === 0) {
        return (
            <div className="flex-grow flex flex-col items-center justify-center text-outline p-12 text-center h-full animate-pulse">
                <MessageSquare className="w-8 h-8 opacity-25 mb-3 text-primary" />
                <p className="text-xs font-semibold">The room is quiet. Waiting for the companions to whisper...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col space-y-4 w-full">
            {feed.map((msg, i) => {
                const isFromMe = msg.from?.userId === user.userId && msg.type === 'user_message';
                const isSystem = msg.type === 'system';
                const isAuto = msg.type?.startsWith('auto') || msg.type === 'auto_cross';
                const displayMessage = isAuto ? stripDecorativeEmoji(msg.message) : msg.message;

                if (isSystem) {
                    return (
                        <div key={msg.id || i} className="text-center my-1 animate-[fadeIn_0.5s_ease-out]">
                            <span className="inline-block bg-primary/5 text-outline text-[10px] px-3 py-1 rounded-full border border-outline-variant/20 font-bold uppercase tracking-wider">
                                {stripDecorativeEmoji(msg.message)}
                            </span>
                        </div>
                    );
                }

                let bubbleClass = 'w-[88%] md:w-3/4 max-w-lg p-4 rounded-3xl border shadow-sm transition-all duration-300 ';
                if (isFromMe) {
                    bubbleClass += 'self-end bg-primary text-white border-transparent rounded-tr-none';
                } else if (msg.type === 'auto_cross') {
                    bubbleClass += 'self-start bg-tertiary/5 border-tertiary/20 rounded-tl-none';
                } else if (msg.type === 'auto_critical') {
                    bubbleClass += 'self-start bg-error-container/20 border-error/30 rounded-tl-none';
                } else {
                    bubbleClass += 'self-start bg-white border-outline-variant/30 rounded-tl-none';
                }

                return (
                    <div
                        key={msg.id || i}
                        className={`${bubbleClass} flex flex-col gap-1.5 animate-[fadeIn_0.5s_ease-out] hover:-translate-y-0.5`}
                    >
                        <div className={`flex items-center justify-between gap-3 text-[10px] font-bold tracking-wide uppercase ${isFromMe ? 'text-white/80' : 'text-outline'}`}>
                            <div className="flex items-center gap-1.5 min-w-0">
                                {isFromMe ? (
                                    <span className="truncate">You ({msg.from?.name})</span>
                                ) : (
                                    <>
                                        <span className={isAuto ? 'text-primary font-bold truncate' : 'truncate'}>
                                            {msg.from?.personaName || msg.from?.name || 'Companion'}
                                        </span>
                                        {isAuto && (
                                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/10 shrink-0">
                                                Plant
                                            </span>
                                        )}
                                        {msg.from?.isOwner && <span className="text-[8px] font-normal lowercase shrink-0">your plant</span>}
                                    </>
                                )}
                            </div>
                            <span className="font-mono text-[9px] opacity-75 font-normal shrink-0">
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>

                        <p className={`text-sm leading-relaxed whitespace-pre-line ${isFromMe ? 'text-white' : 'text-on-surface'}`}>
                            {displayMessage}
                        </p>
                    </div>
                );
            })}
        </div>
    );
}
