import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Shield } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const blockDomainSchema = z.object({
  confirmation: z.string()
    .min(1, 'Confirmação é obrigatória')
    .refine((val) => val === 'BLOCK', 'Digite exatamente "BLOCK" para confirmar'),
});

type BlockDomainFormData = z.infer<typeof blockDomainSchema>;

interface BlockDomainFormProps {
  domain: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const BlockDomainForm = ({ domain, onConfirm, onCancel, isLoading }: BlockDomainFormProps) => {
  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<BlockDomainFormData>({
    resolver: zodResolver(blockDomainSchema),
    mode: 'onChange',
  });

  const onSubmit = () => {
    onConfirm();
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mx-auto w-16 h-16 bg-danger/10 rounded-full flex items-center justify-center mb-4">
          <Shield className="w-8 h-8 text-danger" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">Confirmar Bloqueio de Domínio</h3>
        <p className="text-muted-foreground mt-2">
          Esta ação bloqueará permanentemente o acesso ao domínio <strong>{domain}</strong>
        </p>
      </div>

      <Alert className="border-warning/20 bg-warning/10">
        <AlertTriangle className="h-4 w-4 text-warning" />
        <AlertDescription className="text-warning-foreground">
          O bloqueio afetará todos os usuários da organização imediatamente.
        </AlertDescription>
      </Alert>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Label htmlFor="confirmation">
            Digite <strong>"BLOCK"</strong> para confirmar:
          </Label>
          <Input
            id="confirmation"
            {...register('confirmation')}
            placeholder="BLOCK"
            className={errors.confirmation ? 'border-destructive' : ''}
            autoComplete="off"
          />
          {errors.confirmation && (
            <p className="text-sm text-destructive mt-1">
              {errors.confirmation.message}
            </p>
          )}
        </div>

        <div className="flex gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="destructive"
            disabled={!isValid || isLoading}
            className="flex-1"
          >
            {isLoading ? 'Bloqueando...' : 'Confirmar Bloqueio'}
          </Button>
        </div>
      </form>
    </div>
  );
};