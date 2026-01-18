import React, { useState, useEffect } from 'react';
import { Spinner } from "@heroui/react";
import { storageService } from '../../services/storage';
import { isVideoFile } from '../../services/fileUtils';

import { X, AlertTriangle } from 'lucide-react';

interface AssetPreviewProps {
    path: string;
    t: any;
}

const AssetPreview: React.FC<AssetPreviewProps> = ({ path, t }) => {
    const isVideo = isVideoFile(path);
    const [url, setUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        storageService.getAssetUrl(path).then(u => {
            setUrl(u || '');
            setLoading(false);
        });
    }, [path]);
    
    if (loading) return <Spinner size="lg" />;

    if (!url) {
        return (
            <div className="flex flex-col items-center justify-center gap-4 text-slate-400">
                <AlertTriangle size={48} className="text-warning opacity-50" />
                <p className="text-sm font-bold uppercase tracking-widest opacity-50">{t.project.fileNotFound}</p>
            </div>
        );
    }
    
    if (isVideo) {
        return (
            <video 
                src={url} 
                controls 
                className="w-full h-full object-contain"
                autoPlay
                loop
            />
        );
    }
    
    return (
        <img 
            src={url} 
            alt={t.project.resourceManager.imageAlt} 
            className="w-full h-full object-contain"
        />
    );
};

export default AssetPreview;
