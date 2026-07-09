import { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, parseISO, isToday, addMonths, subMonths } from 'date-fns';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';

interface DatePickerProps {
  availableDates: string[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
}

export function DatePicker({ availableDates, selectedDate, onSelectDate }: DatePickerProps) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    if (selectedDate && selectedDate !== 'latest') {
      return parseISO(selectedDate);
    }
    // If 'latest', default to the most recent available date's month, or today
    if (availableDates.length > 0) {
      return parseISO(availableDates[0]);
    }
    return new Date();
  });

  const [isOpen, setIsOpen] = useState(false);

  const days = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const startDay = getDay(startOfMonth(currentMonth));
  
  const blanks = Array.from({ length: startDay }).map((_, i) => (
    <div key={`blank-${i}`} className="h-8 w-8" />
  ));

  const handlePrevMonth = () => setCurrentMonth(prev => subMonths(prev, 1));
  const handleNextMonth = () => setCurrentMonth(prev => addMonths(prev, 1));

  const isDateAvailable = (date: Date) => {
    const formatted = format(date, 'yyyy-MM-dd');
    return availableDates.includes(formatted);
  };

  const handleSelect = (date: Date) => {
    if (isDateAvailable(date)) {
      onSelectDate(format(date, 'yyyy-MM-dd'));
      setIsOpen(false);
    }
  };

  const displayLabel = selectedDate === 'latest' 
    ? 'Latest' 
    : format(parseISO(selectedDate), 'MMM d, yyyy');

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger className="inline-flex items-center gap-2 text-sm bg-background border border-input rounded-md px-3 py-1.5 h-9 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer font-medium hover:bg-muted/50 transition-colors">
        <CalendarIcon className="h-4 w-4 opacity-70" />
        {displayLabel}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={handlePrevMonth}
            className="p-1 hover:bg-muted rounded-md transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="font-medium text-sm">
            {format(currentMonth, 'MMMM yyyy')}
          </div>
          <button
            onClick={handleNextMonth}
            className="p-1 hover:bg-muted rounded-md transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        
        <div className="grid grid-cols-7 gap-1 text-center text-xs mb-2">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
            <div key={day} className="text-muted-foreground font-medium w-8">
              {day}
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-7 gap-1">
          {blanks}
          {days.map(day => {
            const available = isDateAvailable(day);
            const formatted = format(day, 'yyyy-MM-dd');
            const isSelected = selectedDate === formatted;
            
            return (
              <button
                key={day.toISOString()}
                disabled={!available}
                onClick={() => handleSelect(day)}
                className={`
                  h-8 w-8 rounded-md text-sm flex items-center justify-center transition-colors
                  ${!available ? 'text-muted-foreground/30 cursor-not-allowed' : 'hover:bg-muted cursor-pointer'}
                  ${isSelected ? 'bg-primary text-primary-foreground hover:bg-primary/90 font-bold' : ''}
                  ${isToday(day) && !isSelected ? 'text-primary font-bold bg-primary/10' : ''}
                `}
              >
                {format(day, 'd')}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
