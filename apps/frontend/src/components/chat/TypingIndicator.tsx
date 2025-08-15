'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Bot } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export function TypingIndicator() {
  return (
    <div className="flex items-start space-x-3">
      <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-blue-500 text-white">
        <Bot className="h-5 w-5" />
      </div>
      
      <Card className="mr-auto bg-muted">
        <CardContent className="p-4">
          <div className="flex items-center space-x-1">
            <span className="text-sm text-muted-foreground mr-2">Shadow is thinking</span>
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2 h-2 bg-primary rounded-full"
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.5, 1, 0.5],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  delay: i * 0.2,
                }}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}