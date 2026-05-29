import pandas as pd
import json
import sys

def main():
    try:
        df = pd.read_excel('Master_Data.xlsx', nrows=5)
        info = {
            'columns': list(df.columns),
            'sample_data': df.to_dict(orient='records')
        }
        print(json.dumps(info, indent=2, default=str))
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
