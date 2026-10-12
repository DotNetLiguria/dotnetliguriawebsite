import React, { FC, useState } from 'react';
import { Button, Dialog, Heading, Modal, ModalOverlay, ToggleButton, ToggleButtonGroup } from 'react-aria-components';
import { AdminIcon } from '../../admin/icons';
import { btn } from '../../admin/ui';
import { pill } from '../../admin/pages/listUi';
import { Icon } from './designerUi';
import QuestionnaireRunner from '../QuestionnaireRunner/QuestionnaireRunner';
import type { Questionnaire } from '../../questionnaire/types';

type Device = 'desktop' | 'mobile';

/** Full-page preview with the real public runner; answers are validated but never sent. */
const PreviewDialog: FC<{ open: boolean; questionnaire: Questionnaire; onClose: () => void }> = ({ open, questionnaire, onClose }) => {
  const [device, setDevice] = useState<Device>('desktop');
  return (
    <ModalOverlay isOpen={open} onOpenChange={isOpen => { if (!isOpen) onClose(); }} className="fixed inset-0 z-50 bg-[rgb(0_36_69/0.42)]">
      <Modal className="h-dvh w-full bg-[#f3f7fa] text-navy">
        <Dialog aria-label="Anteprima del questionario" className="flex h-full flex-col outline-none">
          <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-white px-4 py-2.5 sm:px-6">
            <Button slot="close" aria-label="Chiudi anteprima" className={btn.icon}><AdminIcon name="x" /></Button>
            <div className="min-w-0 flex-1">
              <Heading slot="title" className="text-xl font-bold leading-tight">Anteprima</Heading>
              <p className="text-sm text-muted">Le risposte non vengono salvate.</p>
            </div>
            <ToggleButtonGroup
              aria-label="Dispositivo"
              selectionMode="single"
              disallowEmptySelection
              selectedKeys={[device]}
              onSelectionChange={keys => { const next = [...keys][0]; if (next === 'desktop' || next === 'mobile') setDevice(next); }}
              className="flex gap-2"
            >
              <ToggleButton id="desktop" className={pill}><Icon name="desktop" className="size-4.5" />Desktop</ToggleButton>
              <ToggleButton id="mobile" className={pill}><Icon name="phone" className="size-4.5" />Smartphone</ToggleButton>
            </ToggleButtonGroup>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-6 sm:px-6">
            {/* .site gives the public runner its type and focus ring; the sticky progress bar sits at the top of this frame. */}
            <div
              className={`site min-h-0 [&_.sticky]:top-2 ${device === 'mobile'
                ? 'mx-auto w-[390px] max-w-full rounded-[2rem] border-8 border-navy bg-[#f3f7fa] p-3'
                : 'mx-auto max-w-3xl bg-transparent'}`}
            >
              {open && <QuestionnaireRunner key={`${device}-${questionnaire.version}`} questionnaire={questionnaire} />}
            </div>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default PreviewDialog;
