import React from 'react';
import { Shot } from '../../types';
import { Card, CardBody, CardHeader, Button, Chip, Divider } from '@heroui/react';
import { Camera, Clock, Users, List, Film } from 'lucide-react';
import { useApp } from '../../contexts/context';

interface TimelineShotInfoPanelProps {
  shot: Shot | null;
  onSwitchToListView: () => void;
}

export const TimelineShotInfoPanel: React.FC<TimelineShotInfoPanelProps> = ({
  shot,
  onSwitchToListView,
}) => {
  const { t } = useApp();
  if (!shot) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <div className="text-center text-slate-400">
          <Camera size={48} className="mx-auto mb-4 opacity-50" />
          <p>选择一个分镜查看详情</p>
        </div>
      </div>
    );
  }

  const hasKeyframes = shot.keyframes && shot.keyframes.length > 0;
  const completedKeyframes = hasKeyframes
    ? shot.keyframes!.filter(kf => kf.status === 'completed').length
    : 0;

  const getShotTypeColor = (type: string) => {
    switch (type) {
      case 'extreme_long':
      case 'long':
        return 'default';
      case 'full':
        return 'primary';
      case 'medium':
        return 'secondary';
      case 'close_up':
      case 'extreme_close_up':
        return 'success';
      default:
        return 'default';
    }
  };

  return (
    <div className="h-full flex flex-col p-4 border-l border-content3">
      <div className="flex-1 overflow-auto">
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-lg font-bold">
                    {shot.shotNumber || `镜头 ${shot.sequence}`}
                  </h4>
                  <p className="text-sm text-slate-400">{shot.sceneName || '未分类场景'}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {shot.layer === 'key' && (
                    <Chip color="primary" variant="solid">
                      关键镜头
                    </Chip>
                  )}
                  <Chip color={getShotTypeColor(shot.shotType) as any} variant="flat">
                    {t.shot?.shotType?.[shot.shotType as keyof typeof t.shot.shotType] ||
                      shot.shotType}
                  </Chip>
                </div>
              </div>
            </CardHeader>
            <CardBody className="pt-0">
              <div className="space-y-4">
                <div>
                  <h5 className="text-sm font-medium text-slate-300 mb-2">画面描述</h5>
                  <p className="text-sm text-slate-400 bg-content2 p-3 rounded-lg">
                    {shot.description || '暂无描述'}
                  </p>
                </div>

                {shot.dialogue && (
                  <div>
                    <h5 className="text-sm font-medium text-slate-300 mb-2">台词</h5>
                    <p className="text-sm text-slate-400 bg-content2 p-3 rounded-lg italic">
                      "{shot.dialogue}"
                    </p>
                  </div>
                )}

                {shot.sound && (
                  <div>
                    <h5 className="text-sm font-medium text-slate-300 mb-2">音效</h5>
                    <p className="text-sm text-slate-400 bg-content2 p-3 rounded-lg">
                      {shot.sound}
                    </p>
                  </div>
                )}

                <Divider />

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <Camera size={16} className="text-slate-400" />
                    <div>
                      <div className="text-xs text-slate-500">运镜</div>
                      <div className="text-sm">
                        {t.shot?.cameraMovement?.[
                          shot.cameraMovement as keyof typeof t.shot.cameraMovement
                        ] || shot.cameraMovement}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock size={16} className="text-slate-400" />
                    <div>
                      <div className="text-xs text-slate-500">时长</div>
                      <div className="text-sm">{shot.duration}秒</div>
                    </div>
                  </div>
                </div>

                {hasKeyframes && (
                  <>
                    <Divider />
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="text-sm font-medium text-slate-300">关键帧</h5>
                        <Chip
                          color={
                            completedKeyframes === shot.keyframes!.length ? 'success' : 'default'
                          }
                          variant="flat"
                        >
                          {completedKeyframes}/{shot.keyframes!.length} 已生成
                        </Chip>
                      </div>
                      <div className="space-y-2">
                        {shot.keyframes!.map((kf, index) => (
                          <div
                            key={kf.id}
                            className="flex items-center gap-2 p-2 bg-content2 rounded-lg"
                          >
                            <Chip
                              color={
                                kf.frameType === 'start'
                                  ? 'success'
                                  : kf.frameType === 'end'
                                    ? 'primary'
                                    : 'default'
                              }
                              variant="flat"
                            >
                              {kf.frameType === 'start'
                                ? '开始'
                                : kf.frameType === 'end'
                                  ? '结束'
                                  : '中间'}
                            </Chip>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-slate-300 truncate">
                                {kf.description ||
                                  kf.prompt?.substring(0, 30) ||
                                  '关键帧 ' + (index + 1)}
                              </p>
                            </div>
                            <Chip
                              color={
                                kf.status === 'completed'
                                  ? 'success'
                                  : kf.status === 'generating'
                                    ? 'primary'
                                    : 'default'
                              }
                              variant="flat"
                            >
                              {kf.status === 'completed'
                                ? '已完成'
                                : kf.status === 'generating'
                                  ? '生成中'
                                  : '待生成'}
                            </Chip>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {shot.characters && shot.characters.length > 0 && (
                  <>
                    <Divider />
                    <div>
                      <h5 className="text-sm font-medium text-slate-300 mb-2">
                        <Users size={16} className="inline mr-1" />
                        涉及角色
                      </h5>
                      <div className="flex flex-wrap gap-2">
                        {shot.characters.map((char, index) => (
                          <Chip key={index} variant="bordered">
                            {char}
                          </Chip>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-content3">
        <Button
          fullWidth
          variant="solid"
          color="primary"
          startContent={<List size={16} />}
          onPress={onSwitchToListView}
        >
          跳转到列表视图
        </Button>
      </div>
    </div>
  );
};
