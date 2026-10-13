import { Input, type InputProps } from 'antd';
import { Loader2, Search } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface SearchInputProps extends Omit<InputProps, 'value' | 'defaultValue' | 'onChange'> {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** Debounce delay in milliseconds. Defaults to 300ms. */
  delay?: number;
  loading?: boolean;
}

/**
 * Reusable debounced live-search input with an Ant Design base and Lucide search/loading icons.
 * Automatically triggers `onChange` 300ms after the user finishes typing or immediately upon Enter / Clear.
 */
export function SearchInput({
  value,
  defaultValue = '',
  onChange,
  delay = 300,
  loading = false,
  placeholder = 'Tìm kiếm…',
  allowClear = true,
  maxLength = 255,
  className,
  prefix,
  onPressEnter,
  ...rest
}: SearchInputProps) {
  const [prevValue, setPrevValue] = useState<string | undefined>(value);
  const [text, setText] = useState<string>(value ?? defaultValue);
  const timerRef = useRef<number | null>(null);

  // Sync state during render when controlled `value` prop changes
  if (value !== undefined && value !== prevValue) {
    setPrevValue(value);
    setText(value);
  }

  const triggerChange = useCallback(
    (nextText: string) => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      onChange?.(nextText.trim());
    },
    [onChange],
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = e.target.value;
    setText(nextVal);

    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }

    // When cleared via clear button (x) or backspace to empty, trigger immediately
    if (!nextVal) {
      triggerChange('');
      return;
    }

    timerRef.current = window.setTimeout(() => {
      triggerChange(nextVal);
    }, delay);
  };

  const handlePressEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    triggerChange(text);
    onPressEnter?.(e);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const defaultPrefix = loading ? (
    <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
  ) : (
    <Search className="h-4 w-4 text-slate-400 shrink-0" />
  );

  return (
    <Input
      {...rest}
      value={text}
      allowClear={allowClear}
      maxLength={maxLength}
      placeholder={placeholder}
      className={className}
      onChange={handleChange}
      onPressEnter={handlePressEnter}
      prefix={prefix ?? defaultPrefix}
    />
  );
}
