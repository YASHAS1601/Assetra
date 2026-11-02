import win32com.client
try:
    word = win32com.client.Dispatch("Word.Application")
    print("Word Version:", word.Version)
    word.Quit()
except Exception as e:
    print("Error:", e)

