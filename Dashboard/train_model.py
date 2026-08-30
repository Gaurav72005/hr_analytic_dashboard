import os
import pandas as pd
import numpy as np
import pickle
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.svm import SVC
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score

# Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

EXCEL_PATH = os.path.join(BASE_DIR, 'HR_Attrition_Retention_Dataset.xlsx')
CSV_PATH = os.path.join(BASE_DIR, 'Hr_Retention.csv')
MODEL_SAVE_PATH = os.path.join(BASE_DIR, 'retention_action_model.pkl')

PERSONAL_KEYWORDS = ['health', 'family', 'relocat', 'personal', 'spouse', 'emergency', 'mother', 'father', 'died', 'bereavement']

def get_action_from_reason(reason):
    if pd.isna(reason):
        return 'Not Applicable'
    reason_str = str(reason).lower()
    
    if any(k in reason_str for k in PERSONAL_KEYWORDS):
        return 'Not Applicable'
    elif any(k in reason_str for k in ['salary', 'pay', 'compensation', 'underpaid', 'market']):
        return 'Salary Hike'
    elif any(k in reason_str for k in ['burnout', 'overtime', 'workload', 'balance', 'flexible', 'working hours']):
        return 'Flexible Work'
    elif any(k in reason_str for k in ['manager', 'team dynamics', 'conflict', 'trust', 'supervisor']):
        return 'Manager Change'
    elif any(k in reason_str for k in ['stagnant', 'promotion', 'career', 'development', 'growth', 'leadership']):
        return 'Promotion'
    elif any(k in reason_str for k in ['underutilized', 'mismatch', 'role', 'skills']):
        return 'Role Change'
    elif any(k in reason_str for k in ['competitor', 'offer', 'brand']):
        return 'Salary Hike'
    else:
        return 'Not Applicable'

def preprocess_and_clean_data():
    if os.path.exists(EXCEL_PATH):
        print(f"Loading dataset from Excel: {EXCEL_PATH}")
        df = pd.read_excel(EXCEL_PATH)
    else:
        print(f"Loading dataset from CSV: {CSV_PATH}")
        df = pd.read_csv(CSV_PATH)
    
    initial_shape = df.shape
    print(f"Dataset loaded. Initial shape: {initial_shape}")
    
    active_mask = (df['Attrition'] == 'No')
    df.loc[active_mask, 'ExitDate'] = 'N/A'
    df.loc[active_mask, 'Exit_Reason_HR_Recorded'] = 'Employee did not resign'
    df.loc[active_mask, 'Retention_Attempted'] = 'No'
    df.loc[active_mask, 'Retention_Action_Taken'] = 'Not Applicable'
    df.loc[active_mask, 'Retained'] = 'Not Applicable'
    df.loc[active_mask, 'Retention_Outcome_Reason'] = 'Employee did not resign'
    
    no_attempt_mask = (df['Attrition'] == 'Yes') & (df['Retention_Attempted'] == 'No')
    df.loc[no_attempt_mask, 'Retention_Action_Taken'] = 'Not Applicable'
    
    attempted_missing_action_mask = (df['Attrition'] == 'Yes') & (df['Retention_Attempted'] == 'Yes') & (df['Retention_Action_Taken'].isna())
    df.loc[attempted_missing_action_mask, 'Retention_Action_Taken'] = df.loc[attempted_missing_action_mask, 'Exit_Reason_HR_Recorded'].apply(get_action_from_reason)
    
    personal_exit_mask = (df['Attrition'] == 'Yes') & df['Exit_Reason_HR_Recorded'].astype(str).str.lower().apply(lambda r: any(k in r for k in PERSONAL_KEYWORDS))
    df.loc[personal_exit_mask, 'Retention_Action_Taken'] = 'Not Applicable'
    
    if 'HireDate' in df.columns:
        df['Year'] = pd.to_datetime(df['HireDate']).dt.year
    elif 'YearsAtCompany' in df.columns:
        df['Year'] = 2025 - df['YearsAtCompany']
    if 'HireYear' in df.columns:
        df.drop(columns=['HireYear'], inplace=True, errors='ignore')
        
    def categorize_reason(reason):
        if pd.isna(reason) or reason in ['Employee did not resign', 'N/A']:
            return 'Not Applicable'
        r = str(reason).lower()
        if any(k in r for k in PERSONAL_KEYWORDS):
            return 'Personal & Non-Negotiable'
        elif any(k in r for k in ['salary', 'pay', 'compensation', 'underpaid']):
            return 'Compensation & Benefits'
        elif any(k in r for k in ['burnout', 'overtime', 'workload', 'balance']):
            return 'Work-Life Balance'
        elif any(k in r for k in ['manager', 'team', 'conflict', 'trust', 'supervisor']):
            return 'Management & Culture'
        elif any(k in r for k in ['stagnant', 'promotion', 'career', 'opportunity', 'brand', 'competitor', 'leadership']):
            return 'Career Advancement'
        elif any(k in r for k in ['underutilized', 'mismatch', 'role', 'skills']):
            return 'Role Mismatch'
        return 'Other'
        
    df['Reason_Category'] = df['Exit_Reason_HR_Recorded'].apply(categorize_reason)
        
    return df

def train_and_save_model(df):
    print("\nTraining 6-Class Retention Action Recommendation Model (TF-IDF + Linear SVC)...")
    
    training_data = df[df['Attrition'] == 'Yes'].copy()
    training_data['Retention_Action_Taken'] = training_data['Exit_Reason_HR_Recorded'].apply(get_action_from_reason)
    
    X = training_data['Exit_Reason_HR_Recorded']
    y = training_data['Retention_Action_Taken']
    
    target_classes = sorted(list(y.unique()))
    print(f"Training set size: {len(training_data)} rows. Target classes: {target_classes}")
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    
    vectorizer = TfidfVectorizer(max_features=1000, stop_words='english', ngram_range=(1, 2))
    X_train_tfidf = vectorizer.fit_transform(X_train)
    X_test_tfidf = vectorizer.transform(X_test)
    
    svm_model = SVC(kernel='linear', decision_function_shape='ovr', class_weight='balanced', probability=True, random_state=42)
    svm_model.fit(X_train_tfidf, y_train)
    
    y_pred = svm_model.predict(X_test_tfidf)
    acc = accuracy_score(y_test, y_pred)
    
    print(f"\nModel Accuracy: {acc * 100:.2f}%")
    print("\nClassification Report:\n", classification_report(y_test, y_pred))
    
    model_bundle = {
        'vectorizer': vectorizer,
        'model': svm_model,
        'classes': target_classes
    }
    
    with open(MODEL_SAVE_PATH, 'wb') as f:
        pickle.dump(model_bundle, f)
    print(f"Saved 6-class model bundle to: {MODEL_SAVE_PATH}")
    
    return model_bundle

if __name__ == '__main__':
    cleaned_df = preprocess_and_clean_data()
    train_and_save_model(cleaned_df)
    
    try:
        cleaned_df.to_csv(CSV_PATH, index=False)
        print(f"Saved cleaned CSV to: {CSV_PATH}")
    except Exception as e:
        print(f"Warning saving CSVs: {str(e)}")
    
    print("\nData processing and model training completed successfully!")
