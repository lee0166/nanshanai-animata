import React from 'react';
import { Sparkles, FolderOpen } from 'lucide-react';
import { Button, Card, CardBody } from "@heroui/react";
import { useApp } from '../contexts/context';

interface WelcomeViewProps {
  onConnect: () => void;
}

const WelcomeView: React.FC<WelcomeViewProps> = ({ onConnect }) => {
  const { t, isInitializing } = useApp();

  if (isInitializing) return null;

  return (
    <div className="h-full flex flex-col items-center justify-center p-6 text-center max-w-[1600px] mx-auto">
        <div className="mb-12 mt-20 p-8 bg-primary/10 rounded-[3rem] animate-pulse">
            <Sparkles className="w-20 h-20 text-primary" />
        </div>
        <h1 className="text-6xl font-black text-slate-900 dark:text-white mb-6 mt-5 tracking-tight uppercase leading-[0.9]">
            {t.workspace.selectTitle}
        </h1>
        <p className="text-xl text-slate-500 dark:text-slate-400 mb-12 mt-5 leading-relaxed font-medium max-w-xl">
            {t.workspace.selectDesc}
        </p>
        
        <Button
            onPress={onConnect}
            color="primary"
            variant="shadow"
            size="lg"
            radius="lg"
            startContent={<FolderOpen className="w-6 h-6 mr-1" />}
            className="px-12 py-8 text-xl font-black uppercase tracking-wider shadow-2xl shadow-primary/40 transform transition-all duration-500 hover:scale-110 hover:shadow-primary/60 hover:rotate-1"
        >
            {t.workspace.button}
        </Button>
        
        <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-8 text-left w-full px-10">
            {[
                { title: t.workspace.features.local.title, desc: t.workspace.features.local.desc },
                { title: t.workspace.features.ai.title, desc: t.workspace.features.ai.desc },
                { title: t.workspace.features.open.title, desc: t.workspace.features.open.desc }
            ].map((item, i) => (
                <Card 
                  key={i} 
                  className="border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/60 backdrop-blur-xl" 
                  shadow="sm" 
                  radius="lg"
                >
                  <CardBody className="p-8">
                    <h3 className="text-xl font-black text-primary uppercase tracking-widest mb-2">{item.title}</h3>
                    <p className="text-base text-slate-500 dark:text-slate-400 font-medium leading-relaxed">{item.desc}</p>
                  </CardBody>
                </Card>
            ))}
        </div>
    </div>
  );
};

export default WelcomeView;
