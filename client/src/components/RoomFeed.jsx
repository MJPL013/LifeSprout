import { Heart, Droplets, Sparkles, Smile, MessageCircle } from 'lucide-react';

const iconsForReaction = {
    '💚': Heart,
    '💧': Droplets,
    '✨': Sparkles,
    '😂': Smile,
    '🌱': MessageCircle
};

export default function RoomFeed({ feed, user }) {
    if (!feed || feed.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-sage p-12 text-center h-full">
                <MessageCircle className="w-8 h-8 opacity-20 mb-3" />
                <p className="text-sm">The room is quiet. Waiting for the plants to wake up.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {feed.map((msg, i) => {
                // Different styling based on message origin
                // V5 Fix: Safely optional-chain msg.from to prevent crashes on system messages
                const isFromMe = msg.from?.userId === user.userId && msg.type === 'user_message';
                const isSystem = msg.type === 'system';
                const isAuto = msg.type.startsWith('auto');

                if (isSystem) {
                    return (
                        <div key={msg.id} className="text-center">
                            <span className="inline-block bg-forest-green/5 text-sage text-xs px-3 py-1 rounded-full border border-sage/20">
                                {msg.message}
                            </span>
                        </div>
                    );
                }

                return (
                    <div
                        key={msg.id}
                        className={`flex flex-col border border-sage/20 rounded-2xl p-4 shadow-sm w-3/4
              ${isFromMe ? 'self-end bg-forest-green/10 border-forest-green/30 rounded-br-sm' : 'self-start bg-white rounded-bl-sm'}
              ${msg.type === 'auto_critical' ? 'border-critical/30 bg-critical/5' : ''}
            `}
                    >
                        {/* Header */}
                        <div className={`flex items-end mb-2 gap-2 ${isFromMe ? 'justify-end flex-row-reverse' : 'justify-between'}`}>
                            <div className={`flex items-center gap-2 ${isFromMe ? 'flex-row-reverse' : ''}`}>
                                <span className="text-sm font-bold text-forest-green">
                                    {msg.type === 'auto_personal' ? '🌿' : (msg.type === 'user_message' ? '👤' : '🔄')}
                                    {' '}{msg.from.personaName} {msg.type.startsWith('auto') ? <span className="text-xs text-sage ml-1 bg-forest-green/10 px-1.5 py-0.5 rounded-md">Bot</span> : ''}
                                    <span className="text-xs text-sage mx-1 font-normal">
                                        {msg.from.isOwner ? '(You)' : (msg.type === 'user_message' ? '(Human)' : '')}
                                    </span>
                                </span>
                            </div>
                            <span className="text-[10px] text-sage font-mono uppercase">
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>

                        {/* Body */}
                        <p className={`text-ink text-sm leading-relaxed whitespace-pre-line px-2 ${isFromMe ? 'text-right' : 'border-l-2 border-sage/20 pl-4'}`}>
                            "{msg.message}"
                        </p>

                        {/* Action Bar (Mocked Reacions) */}
                        {!isFromMe && (
                            <div className="flex gap-2 mt-3 pl-4">
                                {['💚', '🌱', '😂'].map(emoji => (
                                    <button
                                        key={emoji}
                                        className="bg-parchment hover:bg-forest-green/10 text-xs px-2 py-1 rounded-full transition-colors flex items-center shadow-sm border border-sage/10 text-sage"
                                    >
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
