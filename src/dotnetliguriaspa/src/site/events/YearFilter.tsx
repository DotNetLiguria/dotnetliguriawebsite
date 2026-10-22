import React from 'react';
import { Button, ToggleButton, ToggleButtonGroup } from 'react-aria-components';

type Props = { years: number[]; selected: string; onSelect: (year: string) => void };

export default function YearFilter({ years, selected, onSelect }: Props) {
  const options = ['tutti', ...years.map(String)];
  const index = options.indexOf(selected);

  return (
    <div className="year-filter">
      <div className="year-filter-heading">
        <p id="year-filter-label">Filtra per anno</p>
        <div className="year-filter-navigation" role="group" aria-label="Navigazione anni">
          <Button className="year-filter-arrow" isDisabled={index <= 0} onPress={() => onSelect(options[index - 1])}>
            <span aria-hidden="true">←</span> Precedente
          </Button>
          <Button className="year-filter-arrow" isDisabled={index === options.length - 1} onPress={() => onSelect(options[index + 1])}>
            Successivo <span aria-hidden="true">→</span>
          </Button>
        </div>
      </div>
      <ToggleButtonGroup
        aria-labelledby="year-filter-label"
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={[selected]}
        onSelectionChange={keys => {
          const [key] = [...keys];
          if (key !== undefined) onSelect(String(key));
        }}
        className="year-filter-track"
      >
        <ToggleButton id="tutti" className="year-filter-year year-filter-all">Tutti gli anni</ToggleButton>
        {years.map(year => <ToggleButton key={year} id={String(year)} className="year-filter-year">{year}</ToggleButton>)}
      </ToggleButtonGroup>
    </div>
  );
}
