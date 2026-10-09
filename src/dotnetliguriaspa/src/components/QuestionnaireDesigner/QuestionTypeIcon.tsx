import React from 'react';
import ShortTextIcon from '@mui/icons-material/ShortText';
import NotesIcon from '@mui/icons-material/Notes';
import AlternateEmailIcon from '@mui/icons-material/AlternateEmail';
import RadioButtonCheckedIcon from '@mui/icons-material/RadioButtonChecked';
import CheckBoxOutlinedIcon from '@mui/icons-material/CheckBoxOutlined';
import ToggleOnOutlinedIcon from '@mui/icons-material/ToggleOnOutlined';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import LinearScaleIcon from '@mui/icons-material/LinearScale';
import GridOnIcon from '@mui/icons-material/GridOn';
import PinOutlinedIcon from '@mui/icons-material/PinOutlined';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import type { QuestionType } from '../../questionnaire/types';

const icons: Record<QuestionType, typeof ShortTextIcon> = {
  ShortText: ShortTextIcon,
  LongText: NotesIcon,
  Email: AlternateEmailIcon,
  SingleChoice: RadioButtonCheckedIcon,
  MultipleChoice: CheckBoxOutlinedIcon,
  YesNo: ToggleOnOutlinedIcon,
  Rating: StarBorderIcon,
  Scale: LinearScaleIcon,
  Matrix: GridOnIcon,
  Number: PinOutlinedIcon,
  Date: EventOutlinedIcon,
  InfoText: InfoOutlinedIcon,
};

export const QuestionTypeIcon = ({ type, fontSize = 'small' }: { type: QuestionType; fontSize?: 'small' | 'medium' | 'inherit' }) => {
  const Icon = icons[type];
  return <Icon fontSize={fontSize} />;
};
