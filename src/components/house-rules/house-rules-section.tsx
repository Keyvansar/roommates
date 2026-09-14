'use client';

import { useState, useEffect } from 'react';
import { useHousehold } from '@/hooks/use-household';
import { apiClient } from '@/lib/api-client';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Plus, ThumbsUp, ThumbsDown, Bell, AlertCircle, Trash2, Edit } from 'lucide-react';

interface HouseRule {
  id: string;
  title: string;
  description?: string;
  type: 'normal' | 'reminder' | 'nudge';
  status: 'pending' | 'active' | 'archived';
  proposedBy: { name: string; avatarEmoji?: string };
  votes: Array<{ vote: string; profile: { name: string } }>;
  approveVotes: number;
  rejectVotes: number;
  threshold: number;
  isApproved: boolean;
  createdAt: string;
}

export function HouseRulesSection() {
  const { household } = useHousehold();
  const [rules, setRules] = useState<HouseRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newRuleTitle, setNewRuleTitle] = useState('');
  const [newRuleDescription, setNewRuleDescription] = useState('');
  const [newRuleType, setNewRuleType] = useState<'normal' | 'reminder' | 'nudge'>('normal');

  useEffect(() => {
    if (household?.id) {
      fetchRules();
    }
  }, [household?.id]);

  const fetchRules = async () => {
    if (!household?.id) return;
    try {
      const data = await apiClient.get(`/api/house-rules?householdId=${household.id}`);
      setRules(data);
    } catch (error) {
      console.error('Failed to fetch rules:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRule = async () => {
    if (!newRuleTitle.trim() || !household?.id) return;

    try {
      await apiClient.post('/api/house-rules', {
        householdId: household.id,
        title: newRuleTitle.trim(),
        description: newRuleDescription.trim() || undefined,
        type: newRuleType,
      });
      setNewRuleTitle('');
      setNewRuleDescription('');
      setIsDialogOpen(false);
      fetchRules();
    } catch (error) {
      console.error('Failed to create rule:', error);
    }
  };

  const handleVote = async (ruleId: string, vote: 'approve' | 'reject') => {
    try {
      await apiClient.post(`/api/house-rules/${ruleId}/vote`, { vote });
      fetchRules();
    } catch (error) {
      console.error('Failed to vote:', error);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm('آیا از حذف این قانون مطمئن هستید؟')) return;
    try {
      await apiClient.delete(`/api/house-rules/${ruleId}`);
      fetchRules();
    } catch (error) {
      console.error('Failed to delete rule:', error);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'reminder':
        return <Bell className="w-4 h-4" />;
      case 'nudge':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'reminder':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'nudge':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return 'در انتظار تأیید';
      case 'active':
        return 'فعال';
      case 'archived':
        return 'بایگانی‌شده';
      default:
        return status;
    }
  };

  if (loading) {
    return <div className="text-center py-8">در حال بارگذاری قوانین...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">قوانین خانه</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 ml-2" />
              قانون جدید
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>ایجاد قانون جدید خانه</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Input
                placeholder="عنوان قانون"
                value={newRuleTitle}
                onChange={(e) => setNewRuleTitle(e.target.value)}
                dir="rtl"
              />
              <Textarea
                placeholder="توضیحات (اختیاری)"
                value={newRuleDescription}
                onChange={(e) => setNewRuleDescription(e.target.value)}
                dir="rtl"
                rows={3}
              />
              <div className="space-y-2">
                <label className="text-sm font-medium">نوع قانون:</label>
                <div className="flex gap-2">
                  <Button
                    variant={newRuleType === 'normal' ? 'default' : 'outline'}
                    onClick={() => setNewRuleType('normal')}
                    className="flex-1"
                  >
                    عادی
                  </Button>
                  <Button
                    variant={newRuleType === 'reminder' ? 'default' : 'outline'}
                    onClick={() => setNewRuleType('reminder')}
                    className="flex-1"
                  >
                    یادآوری
                  </Button>
                  <Button
                    variant={newRuleType === 'nudge' ? 'default' : 'outline'}
                    onClick={() => setNewRuleType('nudge')}
                    className="flex-1"
                  >
                    پیشنهاد
                  </Button>
                </div>
              </div>
              <Button onClick={handleCreateRule} className="w-full" disabled={!newRuleTitle.trim()}>
                ایجاد قانون
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {rules.length === 0 ? (
        <Card className="p-6 text-center text-muted-foreground">
          هنوز قانونی ثبت نشده است. اولین قانون را اضافه کنید!
        </Card>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <Card key={rule.id} className={`p-4 ${rule.type !== 'normal' ? 'border-2' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-lg">{rule.title}</h3>
                    <Badge className={getTypeColor(rule.type)}>
                      {getTypeIcon(rule.type)}
                      <span className="mr-1">
                        {rule.type === 'reminder' ? 'یادآوری' : rule.type === 'nudge' ? 'پیشنهاد' : 'عادی'}
                      </span>
                    </Badge>
                    <Badge variant={rule.status === 'active' ? 'default' : 'secondary'}>
                      {getStatusLabel(rule.status)}
                    </Badge>
                  </div>
                  {rule.description && (
                    <p className="text-sm text-muted-foreground" dir="rtl">
                      {rule.description}
                    </p>
                  )}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>
                      پیشنهاد توسط:{' '}
                      {rule.proposedBy.avatarEmoji && <span className="ml-1">{rule.proposedBy.avatarEmoji}</span>}
                      {rule.proposedBy.name}
                    </span>
                  </div>
                  {rule.status === 'pending' && (
                    <div className="flex items-center gap-4 mt-3 pt-3 border-t">
                      <div className="flex-1">
                        <div className="flex justify-between text-xs mb-1">
                          <span>رأی موافق: {rule.approveVotes}</span>
                          <span>مورد نیاز: {rule.threshold}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                          <div
                            className="bg-green-600 h-2 rounded-full transition-all"
                            style={{ width: `${Math.min((rule.approveVotes / rule.threshold) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleVote(rule.id, 'approve')}
                          className="text-green-600 hover:text-green-700"
                        >
                          <ThumbsUp className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleVote(rule.id, 'reject')}
                          className="text-red-600 hover:text-red-700"
                        >
                          <ThumbsDown className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDeleteRule(rule.id)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
