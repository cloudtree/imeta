-- 영문약어(abb_word_nm) 중복 불허 제약조건 추가
ALTER TABLE words
    ADD CONSTRAINT uq_words_abb_word_nm UNIQUE (abb_word_nm);
